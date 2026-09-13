import React, { useState, useRef } from "react";
import { useApp, useToast } from "../context";
import { Card, Spinner, Badge, RiskGauge, ShapBar } from "../components/ui";
import Icon, { IC } from "../components/icons";
import {
  computeRisk, makeShap, rbg, rc, rbrd, rlbl,
  generateOverallSummary
} from "../utils";
import { parseCSV, REQCOLS } from "../utils";
import { apiFetch } from "../utils";

export default function PredictPage({ setActive, programmesList }) {
  const { t, setStudents } = useApp();
  const toast = useToast();

  const [tab, setTab] = useState("manual");
  const [form, setForm] = useState({
    title: "", name: "", id: "", gender: "", phone: "", email: "",
    programme: programmesList[0] || "Computer Science", level: "200", semester: "1",
    yearOfEnrolment: "", gpa: "", attendance: "", credits: "", required: "",
    failedModules: "0", financialFlag: "0", repeatedCourse: "0", probation: "0", notes: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState({});
  const [bStep, setBStep] = useState("idle");
  const [bFile, setBFile] = useState("");
  const [bRows, setBRows] = useState([]);
  const [bRes, setBRes] = useState([]);
  const [bErr, setBErr] = useState("");
  const [bDrag, setBDrag] = useState(false);
  const [bProg, setBProg] = useState(0);
  const [bFilt, setBFilt] = useState("all");
  const [bSort, setBSort] = useState("risk");
  const fRef = useRef();

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.name || !form.name.trim()) e.name = "Required";
    if (!form.gpa || isNaN(form.gpa) || +form.gpa < 0 || +form.gpa > 4) e.gpa = "0.0-4.0";
    if (!form.attendance || isNaN(form.attendance) || +form.attendance < 0 || +form.attendance > 100) e.attendance = "0-100";
    if (!form.credits || isNaN(form.credits)) e.credits = "Required";
    if (!form.required || isNaN(form.required)) e.required = "Required";
    setErrs(e);
    return !Object.keys(e).length;
  }

  function handleFile(file) {
    if (!file) return;
    if (!["csv", "txt"].includes(file.name.split(".").pop().toLowerCase())) {
      setBErr("Only .csv or .txt files accepted.");
      setBStep("error");
      return;
    }
    setBFile(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const r = parseCSV(e.target.result, programmesList);
      if (!r.ok) { setBErr(r.msg); setBStep("error"); }
      else { setBRows(r.data); setBStep("preview"); }
    };
    reader.readAsText(file);
  }

  async function runBatch() {
    if (!bRows.length) return;
    setBStep("running"); setBProg(0);
    const total = bRows.length;
    let res = [];

    let simulatedProg = 0;
    const STEP_INTERVAL = 180;
    const MAX_SIMULATED = total * 0.88;
    const progTimer = setInterval(() => {
      simulatedProg = Math.min(simulatedProg + Math.max(1, Math.ceil(total * 0.06)), MAX_SIMULATED);
      setBProg(Math.floor(simulatedProg));
    }, STEP_INTERVAL);

    try {
      const data = await apiFetch("/predict/batch", {
        method: "POST", body: JSON.stringify({
          students: bRows.map(s => ({
            student_id: s.id, name: s.name, programme: s.programme,
            level: s.level, semester: s.semester, gpa: s.gpa,
            attendance: s.attendance, credits: s.credits, required: s.required,
            failed_modules: 0, financial_flag: 0, repeated_course: 0, probation: 0,
          }))
        })
      });
      clearInterval(progTimer);
      let fill = Math.floor(simulatedProg);
      const fillTimer = setInterval(() => {
        fill = Math.min(fill + Math.ceil(total * 0.05), total);
        setBProg(fill);
        if (fill >= total) clearInterval(fillTimer);
      }, 60);
      res = bRows.map((s, i) => {
        const br = data.students && data.students[i];
        if (!br || br.risk_score === undefined) throw new Error("Invalid response from backend");
        return { ...s, predicted: br.risk_score };
      });
      toast(`${total} students predicted by ML model | ${data.high || 0} flagged high risk`, "success");
    } catch (apiErr) {
      clearInterval(progTimer);
      toast("Backend unavailable - running local predictions", "info");
      for (let i = 0; i < total; i++) {
        await new Promise(r => setTimeout(r, Math.max(18, 1200 / total)));
        setBProg(i + 1);
        res.push({
          ...bRows[i],
          predicted: computeRisk(bRows[i].gpa, bRows[i].attendance, bRows[i].credits / (bRows[i].required || 90), bRows[i].programme),
        });
      }
    }

    setBRes(res);
    setBStep("results");
    const enriched = res.map(s => ({
      ...s, risk: s.predicted, trend: "stable",
      flags: [
        s.gpa < 2 ? "GPA below minimum" : "",
        s.attendance < 65 ? "Low attendance" : "",
        s.credits / s.required < 0.75 ? "Credit deficit" : "",
        s.predicted >= 0.7 ? "High dropout risk" : "",
      ].filter(Boolean),
      interventions: [],
      shap: makeShap(s.gpa, s.attendance, s.credits / s.required, s.programme, s.semester),
      gpaHist: [null, null, null, s.gpa], progAvg: 0.45,
    }));
    setStudents(prev => {
      const ids = new Set(prev.map(x => x.id));
      return [
        ...prev.map(x => { const ov = enriched.find(e => e.id === x.id); return ov ? { ...x, ...ov, risk: ov.risk } : x; }),
        ...enriched.filter(e => !ids.has(e.id)),
      ];
    });
  }

  function resetBatch() {
    setBStep("idle"); setBFile(""); setBRows([]); setBRes([]); setBErr("");
    setBProg(0); setBFilt("all"); setBSort("risk");
  }

  function exportCSV() {
    const h = ["Name", "ID", "Programme", "Level", "GPA", "Attendance", "Credits", "Risk Score", "Risk Label"];
    const rows = bRes.map(s => [s.name, s.id, s.programme, s.level, s.gpa, s.attendance, s.credits, s.predicted.toFixed(3), rlbl(s.predicted)]);
    const csv = [h, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "edualert_results.csv";
    a.click();
    toast("Exported", "success");
  }

  function dlTpl() {
    const csv = REQCOLS.join(",") + "\nKwame Test,UEN/CS/2025/001,Computer Science,200,1,3.1,85,42,45\nAma Sample,UEN/EE/2025/002,Electrical Eng.,300,2,1.9,61,54,90";
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "template.csv";
    a.click();
  }

  const filtered = bRes
    .filter(s => bFilt === "all" || (bFilt === "high" && s.predicted >= 0.7) || (bFilt === "moderate" && s.predicted >= 0.4 && s.predicted < 0.7) || (bFilt === "low" && s.predicted < 0.4))
    .sort((a, b) => bSort === "risk" ? b.predicted - a.predicted : bSort === "gpa" ? b.gpa - a.gpa : a.name.localeCompare(b.name));

  const iS = (k) => ({
    width: "100%", padding: "9px 12px", background: t.inputBg,
    border: "1px solid " + (errs[k] ? t.danger : t.border2),
    borderRadius: 8, color: t.text, fontSize: 13,
  });

  async function runManual() {
    if (!validate()) return;
    setLoading(true);
    const gpa = +form.gpa, att = +form.attendance, cr = +form.credits / +form.required, sem = +form.semester;
    const fail = +form.failedModules || 0, fin = +form.financialFlag || 0, rep = +form.repeatedCourse || 0, prob = +form.probation || 0;
    const fullName = (form.title ? form.title + " " : "") + (form.name || "This student").trim();
    try {
      const data = await apiFetch("/predict", {
        method: "POST", body: JSON.stringify({
          student_id: form.id || "MANUAL-" + Date.now(),
          name: fullName, programme: form.programme,
          level: +form.level, semester: sem,
          gpa, attendance: att, credits: +form.credits, required: +form.required,
          failed_modules: fail, financial_flag: fin,
          repeated_course: rep, probation: prob,
        })
      });
      if (!data || data.risk_score === undefined) throw new Error("Invalid response from backend");
      const risk = data.risk_score;
      const shap = data.shap_values || makeShap(gpa, att, cr, form.programme, sem);
      const fakeStu = {
        name: fullName, id: form.id || "MANUAL-" + Date.now(),
        gpa, attendance: att, credits: +form.credits, required: +form.required,
        level: +form.level, semester: sem, programme: form.programme, risk,
        email: form.email, phone: form.phone, gender: form.gender,
        yearOfEnrolment: form.yearOfEnrolment,
        flags: [
          gpa < 2 ? "GPA below minimum" : "",
          att < 65 ? "Low attendance" : "",
          cr < 0.75 ? "Credit deficit" : "",
          fail > 0 ? fail + " failed module" + (fail > 1 ? "s" : "") : "",
          fin ? "Financial hold" : "",
          rep ? "Repeated a course" : "",
          prob ? "Academic probation" : "",
        ].filter(Boolean),
        interventions: form.notes ? [{ date: new Date().toISOString().split("T")[0], note: form.notes, by: "Advisor" }] : [],
      };
      setResult({ risk, shap, student: fakeStu, source: "model" });
      toast("Prediction complete - using trained ML model", "success");
    } catch (apiErr) {
      toast(`Prediction failed: ${apiErr.message}. Please ensure backend is running.`, "error");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto", background: t.bg }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: t.surface2, borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid " + t.border }}>
        {[{ id: "manual", lbl: "Manual Entry" }, { id: "batch", lbl: "Batch Upload" }].map(({ id, lbl }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "9px 22px", borderRadius: 7, border: "none", fontSize: 13,
            fontWeight: tab === id ? 700 : 500,
            background: tab === id ? t.surface : t.surface2,
            color: tab === id ? t.accent : t.muted,
            cursor: "pointer", boxShadow: tab === id ? t.shadow : "none",
          }}>{lbl}</button>
        ))}
      </div>

      {tab === "manual" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <Card style={{ padding: "22px 24px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Personal Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Title</label><select value={form.title} onChange={setF("title")} style={{ ...iS("title"), cursor: "pointer" }}>{"-,Dr.,Prof.,Mr.,Mrs.,Ms.,Rev.,Eng.,Hon.".split(",").map(o => <option key={o} value={o === "-" ? "" : o}>{o}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Full Name</label><input value={form.name} onChange={setF("name")} placeholder="e.g. Kwame Boateng" style={iS("name")} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Student ID</label><input value={form.id} onChange={setF("id")} placeholder="UEN/XX/XXXX/XXX" style={iS("id")} /></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Gender</label><select value={form.gender} onChange={setF("gender")} style={{ ...iS("gender"), cursor: "pointer" }}>{["- Select -","Male","Female","Prefer not to say"].map(o => <option key={o} value={o.startsWith("-") ? "" : o}>{o}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Email <span style={{ fontWeight: 400, color: t.muted }}>(optional)</span></label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon ic={IC.mail} size={13} color={t.muted} /></span><input value={form.email} onChange={setF("email")} placeholder="student@uenr.edu.gh" type="email" style={{ ...iS("email"), paddingLeft: 30 }} /></div></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Phone <span style={{ fontWeight: 400, color: t.muted }}>(optional)</span></label><input value={form.phone} onChange={setF("phone")} placeholder="e.g. 0244 000 000" style={iS("phone")} /></div>
              </div>
              <div style={{ borderTop: "1px solid " + t.border, margin: "16px 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Academic Information</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 10, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Programme</label><select value={form.programme} onChange={setF("programme")} style={{ ...iS("programme"), cursor: "pointer" }}>{programmesList.map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Level</label><select value={form.level} onChange={setF("level")} style={{ ...iS("level"), cursor: "pointer" }}>{["100","200","300","400"].map(o => <option key={o}>{o}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Sem.</label><select value={form.semester} onChange={setF("semester")} style={{ ...iS("semester"), cursor: "pointer" }}>{["1","2"].map(o => <option key={o}>{o}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Year of Enrolment</label><select value={form.yearOfEnrolment} onChange={setF("yearOfEnrolment")} style={{ ...iS("yearOfEnrolment"), cursor: "pointer" }}>{["- Select year -","2019","2020","2021","2022","2023","2024","2025"].map(o => <option key={o} value={o.startsWith("-") ? "" : o}>{o}</option>)}</select></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>GPA <span style={{ fontWeight: 400, color: t.muted }}>(0 - 4.0)</span></label><input value={form.gpa} onChange={setF("gpa")} placeholder="e.g. 2.3" style={iS("gpa")} />{errs.gpa && <div style={{ fontSize: 11, color: t.danger, marginTop: 3 }}>{errs.gpa}</div>}</div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Attendance <span style={{ fontWeight: 400, color: t.muted }}>(%)</span></label><input value={form.attendance} onChange={setF("attendance")} placeholder="e.g. 72" style={iS("attendance")} />{errs.attendance && <div style={{ fontSize: 11, color: t.danger, marginTop: 3 }}>{errs.attendance}</div>}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Credits Earned</label><input value={form.credits} onChange={setF("credits")} placeholder="e.g. 54" style={iS("credits")} />{errs.credits && <div style={{ fontSize: 11, color: t.danger, marginTop: 3 }}>{errs.credits}</div>}</div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Credits Required</label><input value={form.required} onChange={setF("required")} placeholder="e.g. 90" style={iS("required")} />{errs.required && <div style={{ fontSize: 11, color: t.danger, marginTop: 3 }}>{errs.required}</div>}</div>
              </div>
              <div style={{ borderTop: "1px solid " + t.border, margin: "16px 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Risk Flags</div>
              <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>These flags directly influence the risk score - tick all that apply.</div>
              <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Number of Failed Modules</label><select value={form.failedModules} onChange={setF("failedModules")} style={{ ...iS("failedModules"), cursor: "pointer" }}>{["0","1","2","3","4","5+"].map(o => <option key={o} value={o === "5+" ? "5" : o}>{o}</option>)}</select></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {[
                  { k: "financialFlag", l: "Financial Hold / Fee Arrears", sub: "Student has unpaid tuition or a financial hold on their account" },
                  { k: "repeatedCourse", l: "Has Repeated a Course", sub: "Student has previously failed and re-enrolled in at least one module" },
                  { k: "probation", l: "On Academic Probation", sub: "Student is formally on probation due to poor academic performance" },
                ].map(({ k, l, sub }) => (
                  <div key={k} onClick={() => setForm(f => ({ ...f, [k]: f[k] === "1" ? "0" : "1" }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 9,
                      border: "1.5px solid " + (form[k] === "1" ? t.danger : t.border),
                      background: form[k] === "1" ? t.dangerBg : "transparent",
                      cursor: "pointer", transition: "all .15s",
                    }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: "2px solid " + (form[k] === "1" ? t.danger : t.border2), background: form[k] === "1" ? t.danger : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {form[k] === "1" && <Icon ic={IC.check} size={11} color="white" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: form[k] === "1" ? t.danger : t.text }}>{l}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid " + t.border, margin: "4px 0 16px" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Advisor Notes</div>
              <div style={{ marginBottom: 20, position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: 11, display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon ic={IC.note} size={14} color={t.muted} /></span>
                <textarea value={form.notes} onChange={setF("notes")} rows={3} placeholder="Any additional context..." style={{ ...iS("notes"), paddingLeft: 32, resize: "vertical", lineHeight: 1.6 }} />
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Note: This note does not affect the risk score.</div>
              </div>
              <button onClick={runManual} disabled={loading} style={{ width: "100%", padding: "13px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 9, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><Spinner size={18} color="white" thickness={2.5} /> Analysing...</span> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon ic={IC.brain} size={16} color="white" /> Run Prediction</span>}
              </button>
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0 }}>
            {result ? (
              <>
                <Card style={{ padding: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>Prediction Result</div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><RiskGauge value={result.risk} size={120} /></div>
                  <div style={{ padding: "11px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: rbg(result.risk, t), color: rc(result.risk, t), border: "1px solid " + rbrd(result.risk, t) }}>
                    {result.risk >= .7 ? "Immediate intervention recommended" : result.risk >= .4 ? "Proactive check-in recommended" : "Student appears on track"}
                  </div>
                  {result.student.email && <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7, justifyContent: "center", padding: "7px 12px", background: t.surface2, borderRadius: 7, border: "1px solid " + t.border, fontSize: 12, color: t.textSub }}><Icon ic={IC.mail} size={12} color={t.muted} />{result.student.email}</div>}
                  {result.student.flags.length > 0 && <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>{result.student.flags.map((f, i) => <span key={i} style={{ padding: "2px 9px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 10, fontSize: 11, color: t.danger, fontWeight: 600 }}>{f}</span>)}</div>}
                </Card>
                {result.student.notes && <Card style={{ padding: "14px 16px" }}><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Icon ic={IC.note} size={13} color={t.accent} /><div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Advisor Notes</div></div><div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.65, background: t.accentBg, padding: "9px 12px", borderRadius: 7, border: "1px solid " + t.accentMuted }}>{result.student.notes || (result.student.interventions && result.student.interventions[0]?.note)}</div></Card>}
                <Card style={{ padding: "16px 18px" }}><div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Plain-English Summary</div><div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.8 }}>{generateOverallSummary(result.student)}</div></Card>
                <ShapBar data={result.shap} />
                <Card style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>Student Snapshot</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                    {[
                      ["Programme", result.student.programme],
                      ["Level", "Level " + result.student.level + " | Sem " + result.student.semester],
                      ...(result.student.gender ? [["Gender", result.student.gender]] : []),
                      ...(result.student.yearOfEnrolment ? [["Enrolled", result.student.yearOfEnrolment]] : []),
                      ...(result.student.phone ? [["Phone", result.student.phone]] : []),
                    ].map(([label, val], i) => (
                      <div key={i} style={{ padding: "7px 10px", background: t.surface2, borderRadius: 7 }}>
                        <div style={{ color: t.muted, fontSize: 10, fontWeight: 600, marginBottom: 2, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                        <div style={{ color: t.text, fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                <button onClick={() => {
                  setStudents(prev => {
                    const s = { ...result.student, risk: result.risk, shap: result.shap, trend: "stable", gpaHist: [null, null, null, result.student.gpa], progAvg: 0.45 };
                    const ids = new Set(prev.map(x => x.id));
                    if (ids.has(s.id)) return prev.map(x => x.id === s.id ? { ...x, ...s } : x);
                    return [s, ...prev];
                  });
                  toast(result.student.name + " saved to registry", "success");
                }} style={{ padding: "11px 0", background: t.safeBg, border: "1.5px solid " + t.safeMuted, borderRadius: 9, color: t.safe, fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon ic={IC.students} size={14} color={t.safe} /> Save to Student Registry
                </button>
              </>
            ) : (
              <div style={{ minHeight: 320, border: "2px dashed " + t.border2, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
                <div style={{ opacity: .15, display: "flex", justifyContent: "center" }}><Icon ic={IC.predict} size={40} color={t.muted} /></div>
                <div style={{ fontSize: 15, color: t.muted, fontWeight: 600 }}>Results appear here</div>
                <div style={{ fontSize: 13, color: t.muted, maxWidth: 220, lineHeight: 1.6 }}>Fill in the student details on the left and click Run Prediction</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "batch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {bStep === "idle" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Upload Student CSV File</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Select or drag a file - risk scores computed automatically</div>
                </div>
                <div style={{ padding: "20px" }}>
                  <div onDragOver={e => { e.preventDefault(); setBDrag(true); }} onDragLeave={() => setBDrag(false)}
                    onDrop={e => { e.preventDefault(); setBDrag(false); handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => fRef.current.click()}
                    style={{
                      border: "2px dashed " + (bDrag ? t.accent : t.border2), borderRadius: 12,
                      padding: "44px 20px", textAlign: "center", cursor: "pointer",
                      background: bDrag ? t.accentBg : "transparent", transition: "all .18s",
                    }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Icon ic={IC.folder} size={48} color={t.muted} /></div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{bDrag ? "Drop your file here" : "Drag & drop your CSV here"}</div>
                    <div style={{ fontSize: 13, color: t.muted, marginBottom: 20 }}>or click anywhere to browse</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: t.accent, borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600 }}><Icon ic={IC.folder} size={14} color="white" /> Browse Files</div>
                    <input ref={fRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                  </div>
                </div>
              </Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Card style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Required CSV Columns</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>{REQCOLS.map(c => <span key={c} style={{ padding: "3px 9px", background: t.accentBg, borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.accent, border: "1px solid " + t.accentMuted, fontFamily: "monospace" }}>{c}</span>)}</div>
                  <button onClick={dlTpl} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.download} size={14} color={t.textSub} /> Download Template CSV</button>
                </Card>
                <Card style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>How it works</div>
                  {[["1","Prepare CSV with required columns"], ["2","Drop file or click Browse"], ["3","Review parsed data preview"], ["4","Run predictions on all students"], ["5","Filter results and export as CSV"]].map(([n, l]) => (
                    <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: t.accent, flexShrink: 0 }}>{n}</div>
                      <span style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{l}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}
          {bStep === "preview" && (
            <Card>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Preview - {bFile}</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{bRows.length} students parsed</div></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={resetBatch} style={{ padding: "8px 14px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Change File</button>
                  <button onClick={runBatch} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Run on {bRows.length} Students</button>
                </div>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 380 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: t.surface2 }}>{["#","Name","Student ID","Programme","Level","GPA","Attendance","Credits"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: t.muted, borderBottom: "1px solid " + t.border, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                  <tbody>{bRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid " + t.border, background: i % 2 === 0 ? "transparent" : t.surface2 }}>
                      <td style={{ padding: "9px 14px", color: t.muted, fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: t.text }}>{r.name}</td>
                      <td style={{ padding: "9px 14px", color: t.muted, fontFamily: "monospace", fontSize: 11 }}>{r.id}</td>
                      <td style={{ padding: "9px 14px", color: t.textSub }}>{r.programme}</td>
                      <td style={{ padding: "9px 14px", color: t.textSub }}>{r.level}</td>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: r.gpa >= 3 ? t.safe : r.gpa >= 2 ? t.warn : t.danger }}>{r.gpa.toFixed(1)}</td>
                      <td style={{ padding: "9px 14px", color: t.textSub }}>{r.attendance}%</td>
                      <td style={{ padding: "9px 14px", color: t.textSub }}>{r.credits}/{r.required}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          )}
          {bStep === "running" && (
            <Card style={{ padding: "56px 40px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><Spinner size={56} color={t.accent} thickness={4} /></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>Running predictions...</div>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 32 }}>Processing student {Math.min(bProg, bRows.length)} of {bRows.length}</div>
              <div style={{ maxWidth: 480, margin: "0 auto 10px" }}>
                <div style={{ height: 10, background: t.surface2, borderRadius: 10, overflow: "hidden", border: "1px solid " + t.border, marginBottom: 10 }}>
                  <div style={{ height: "100%", width: (bRows.length ? Math.round(bProg / bRows.length * 100) : 0) + "%", background: "linear-gradient(90deg," + t.accent + "," + (bProg > bRows.length * 0.88 ? t.safe : t.accent) + ")", borderRadius: 10, transition: "width .18s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <span style={{ fontSize: 12, color: t.muted }}>0%</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: bProg > bRows.length * 0.88 ? t.safe : t.accent, letterSpacing: "-1px" }}>{bRows.length ? Math.round(bProg / bRows.length * 100) : 0}%</span>
                  <span style={{ fontSize: 12, color: t.muted }}>100%</span>
                </div>
              </div>
            </Card>
          )}
          {bStep === "results" && bRes.length > 0 && (
            <>
              <div style={{ padding: "14px 18px", background: t.safeBg, borderRadius: 10, border: "1px solid " + t.safeMuted, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon ic={IC.check} size={18} color={t.safe} />
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: t.safe }}>Predictions complete</div><div style={{ fontSize: 12, color: t.textSub }}>{bRes.length} students added to the registry.</div></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setActive("dashboard")} style={{ padding: "7px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.dash} size={13} color="white" /> Overview</button>
                  <button onClick={() => setActive("students")} style={{ padding: "7px 14px", background: "none", border: "1px solid " + t.accent, borderRadius: 8, color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.students} size={13} color={t.accent} /> Students</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                  {[
                    { lbl: "Total", val: bRes.length, col: t.accent, bg: t.accentBg, icon: IC.note },
                    { lbl: "High Risk", val: bRes.filter(s => s.predicted >= 0.7).length, col: t.danger, bg: t.dangerBg, icon: IC.alert },
                    { lbl: "Moderate", val: bRes.filter(s => s.predicted >= 0.4 && s.predicted < 0.7).length, col: t.warn, bg: t.warnBg, icon: IC.analytics },
                    { lbl: "Low Risk", val: bRes.filter(s => s.predicted < 0.4).length, col: t.safe, bg: t.safeBg, icon: IC.check },
                  ].map(({ lbl, val, col, bg, icon }, i) => (
                    <Card key={i} style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div><div style={{ fontSize: 11, color: t.muted, fontWeight: 500, marginBottom: 5 }}>{lbl}</div><div style={{ fontSize: 26, fontWeight: 800, color: t.text }}>{val}</div></div>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon ic={icon} size={16} color={col} /></div>
                      </div>
                    </Card>
                  ))}
                </div>
                <Card>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Results - {bFile}</div><div style={{ fontSize: 12, color: t.muted }}>{filtered.length} of {bRes.length} shown</div></div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 4 }}>{["all","high","moderate","low"].map(f => (
                        <button key={f} onClick={() => setBFilt(f)} style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid " + (bFilt === f ? t.accent : t.border), background: bFilt === f ? t.accentBg : "transparent", color: bFilt === f ? t.accent : t.muted }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
                      ))}</div>
                      <select value={bSort} onChange={e => setBSort(e.target.value)} style={{ padding: "6px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 12, cursor: "pointer" }}>
                        <option value="risk">Sort: Risk (High)</option>
                        <option value="gpa">Sort: GPA (High)</option>
                        <option value="name">Sort: Name A-Z</option>
                      </select>
                      <button onClick={exportCSV} style={{ padding: "7px 14px", background: t.safe, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.download} size={13} color="white" /> Export CSV</button>
                      <button onClick={resetBatch} style={{ padding: "7px 14px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.upload} size={13} color={t.textSub} /> New File</button>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ background: t.surface2 }}>{["#","Student","Programme","Level","GPA","Attendance","Credits","Risk Score","Label"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: t.muted, borderBottom: "1px solid " + t.border, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {filtered.map((s, i) => (
                          <tr key={i} className="ea-row" style={{ borderBottom: "1px solid " + t.border }}>
                            <td style={{ padding: "10px 14px", color: t.muted, fontSize: 11, fontFamily: "monospace" }}>{i + 1}</td>
                            <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 600, color: t.text }}>{s.name}</div><div style={{ fontSize: 11, color: t.muted, fontFamily: "monospace", marginTop: 1 }}>{s.id}</div></td>
                            <td style={{ padding: "10px 14px", color: t.textSub }}>{s.programme}</td>
                            <td style={{ padding: "10px 14px", color: t.textSub }}>{s.level}</td>
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: s.gpa >= 3 ? t.safe : s.gpa >= 2 ? t.warn : t.danger }}>{s.gpa.toFixed(1)}</td>
                            <td style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, fontWeight: 500 }}>{s.attendance}%</span><div style={{ width: 48, height: 4, background: t.surface2, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: s.attendance + "%", background: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, borderRadius: 2 }} /></div></div></td>
                            <td style={{ padding: "10px 14px", color: t.textSub }}>{s.credits}/{s.required}</td>
                            <td style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, color: rc(s.predicted, t), fontFamily: "monospace" }}>{(s.predicted * 100).toFixed(1)}%</span><div style={{ width: 56, height: 5, background: t.surface2, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: s.predicted * 100 + "%", background: rc(s.predicted, t), borderRadius: 3 }} /></div></div></td>
                            <td style={{ padding: "10px 14px" }}><Badge risk={s.predicted} sm /></td>
                          </tr>
                        ))}
                        {!filtered.length && <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: t.muted, fontSize: 13 }}>No students match the current filter.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}
          {bStep === "error" && (
            <Card style={{ padding: "48px 40px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Icon ic={IC.alert} size={40} color={t.danger} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.danger, marginBottom: 8 }}>Could not parse file</div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, maxWidth: 440, margin: "0 auto 24px" }}>{bErr}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                <button onClick={resetBatch} style={{ padding: "10px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Try Another File</button>
                <button onClick={dlTpl} style={{ padding: "10px 22px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Download Template</button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}