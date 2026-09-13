import React, { useState, useEffect, useCallback } from "react";
import { useApp, useToast } from "../context";
import { Card, Badge, Avatar, Bar, Sparkline, RiskGauge, ShapBar, GpaTrend, Empty } from "../components/ui";
import Icon, { IC } from "../components/icons";
import {
  rc, rbg, rbrd, rlbl,
  generateOverallSummary, generateWhyFlagged, generateRecommendedActions,
  printReport
} from "../utils";
import { apiFetch } from "../utils";
import {
  UploadModal, ImportModeModal, IntModal, EmailModal,
  FullProfileModal, EditStudentModal
} from "../modals";

export default function StudentsPage({ initSel, notificationFilter, programmesList }) {
  const { t, students, setStudents } = useApp();
  const toast = useToast();

  const PAGE_SIZE = 20;
  const [search, setSearch] = useState("");
  const [prog, setProg] = useState("All Programmes");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(initSel || null);
  const [showUp, setShowUp] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [expTab, setExpTab] = useState("why");
  const [page, setPage] = useState(0);

  // Apply notification filter when prop changes
  useEffect(() => {
    if (notificationFilter) {
      if (notificationFilter.risk) setFilter(notificationFilter.risk);
      if (notificationFilter.programme) setProg(notificationFilter.programme);
      if (notificationFilter.search) setSearch(notificationFilter.search);
    }
  }, [notificationFilter]);

  useEffect(() => { if (initSel) setSel(initSel); }, [initSel]);
  useEffect(() => { setPage(0); }, [search, prog, filter]);

  // ── CRUD functions ──
  const addNote = useCallback(async (id, note) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, interventions: [note, ...(s.interventions || [])] } : s));
    setSel(p => p && p.id === id ? { ...p, interventions: [note, ...(p.interventions || [])] } : p);
    try {
      await apiFetch("/students/" + encodeURIComponent(id) + "/interventions", {
        method: "PATCH", body: JSON.stringify({ note: note.note, by: note.by || "Advisor" })
      });
    } catch (e) { toast(e.message, "error"); }
  }, [setStudents, toast]);

  const deleteStudent = useCallback(async (id) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    if ((sel?.id) === id) setSel(null);
    try {
      await apiFetch("/students/" + encodeURIComponent(id), { method: "DELETE" });
      toast("Student removed", "success");
    } catch (e) { toast(e.message, "error"); }
  }, [setStudents, sel, toast]);

  const saveEditedStudent = useCallback((updated) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSel(updated);
  }, [setStudents]);

  const requestImport = (rows) => setPendingImport(rows);

  const applyImport = useCallback(async (rows, mode) => {
    setPendingImport(null);
    let next = [];
    if (mode === "add") {
      const ids = new Set(students.map(s => s.id));
      const newOnly = rows.filter(r => !ids.has(r.id));
      next = [...students, ...newOnly];
      toast(newOnly.length + " new students added (" + (rows.length - newOnly.length) + " duplicates skipped)", "success");
    } else if (mode === "update") {
      const ids = new Set(students.map(s => s.id));
      next = [
        ...students.map(s => { const ov = rows.find(r => r.id === s.id); return ov ? { ...s, ...ov } : s; }),
        ...rows.filter(r => !ids.has(r.id))
      ];
      toast(rows.length + " students updated/added", "success");
    } else if (mode === "replace") {
      next = rows;
      toast("All records replaced with " + rows.length + " students", "success");
    }
    setStudents(next);
    try {
      if (mode === "replace") {
        await apiFetch("/students/bulk", {
          method: "POST", body: JSON.stringify({
            students: next.map(s => ({
              student_id: s.id, name: s.name, programme: s.programme,
              level: s.level, semester: s.semester, gpa: s.gpa,
              attendance: s.attendance, credits: s.credits, required: s.required,
              failed_modules: 0, financial_flag: 0, repeated_course: 0, probation: 0
            }))
          })
        });
      } else {
        const toSync = mode === "add" ? next.filter(s => rows.find(r => r.id === s.id)) : rows;
        await apiFetch("/students/bulk", {
          method: "POST", body: JSON.stringify({
            students: toSync.map(s => ({
              student_id: s.id, name: s.name, programme: s.programme,
              level: s.level, semester: s.semester, gpa: s.gpa,
              attendance: s.attendance, credits: s.credits, required: s.required,
              failed_modules: 0, financial_flag: 0, repeated_course: 0, probation: 0
            }))
          })
        });
      }
    } catch (e) { toast(e.message, "error"); }
  }, [students, setStudents, toast]);

  // ── Filtering & pagination ──
  const list = students
    .filter(s => {
      if (!s || !s.name || !s.id) return false;
      const ms = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search);
      const mp = prog === "All Programmes" || s.programme === prog;
      const mf = filter === "all" ||
        (filter === "high" && s.risk >= 0.7) ||
        (filter === "moderate" && s.risk >= 0.4 && s.risk < 0.7) ||
        (filter === "low" && s.risk < 0.4);
      return ms && mp && mf;
    })
    .sort((a, b) => b.risk - a.risk);
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const pageList = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const iS = {
    width: "100%", padding: "8px 11px", background: t.inputBg,
    border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13,
  };

  const PRIORITY_COLORS = { urgent: t.danger, high: t.warn, normal: t.accent, low: t.safe };
  const PRIORITY_BG = { urgent: t.dangerBg, high: t.warnBg, normal: t.accentBg, low: t.safeBg };
  const PRIORITY_LABEL = { urgent: "Urgent", high: "High Priority", normal: "Recommended", low: "Routine" };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Modals */}
      {showUp && <UploadModal onClose={() => setShowUp(false)} onImport={requestImport} programmesList={programmesList} />}
      {pendingImport && <ImportModeModal rowCount={pendingImport.length} existingCount={students.length} onConfirm={(mode) => applyImport(pendingImport, mode)} onCancel={() => setPendingImport(null)} />}
      {showNote && sel && <IntModal student={sel} onClose={() => setShowNote(false)} onSave={addNote} />}
      {showEmail && sel && <EmailModal student={sel} onClose={() => setShowEmail(false)} />}
      {showEdit && sel && <EditStudentModal student={sel} onClose={() => setShowEdit(false)} onSave={saveEditedStudent} programmesList={programmesList} />}
      {showFullProfile && sel && <FullProfileModal student={sel} onClose={() => setShowFullProfile(false)} onNote={() => { setShowFullProfile(false); setShowNote(true); }} onEmail={() => { setShowFullProfile(false); setShowEmail(true); }} onPrint={() => printReport(sel)} />}

      {/* ── Student list panel ── */}
      <div style={{ width: 680, borderRight: "1px solid " + t.border, display: "flex", flexDirection: "column", background: t.surface, flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid " + t.border }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..." style={{ ...iS, flex: 1 }} />
            <button onClick={() => setShowUp(true)} style={{ padding: "8px 11px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 8, color: t.accent, cursor: "pointer", display: "flex", alignItems: "center" }}>
              <Icon ic={IC.upload} size={16} color={t.accent} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {["all", "high", "moderate", "low"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  border: "1px solid " + (filter === f ? t.accent : t.border),
                  background: filter === f ? t.accentBg : "transparent",
                  color: filter === f ? t.accent : t.muted,
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <select value={prog} onChange={e => setProg(e.target.value)} style={{ ...iS, cursor: "pointer" }}>
            <option>All Programmes</option>
            {programmesList.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11, color: t.muted, padding: "7px 12px 3px", fontWeight: 500 }}>{list.length} student{list.length !== 1 ? "s" : ""}</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!students.length ? (
            <Empty icon={IC.folder} title="No students loaded" sub="Click upload icon a CSV." t={t} />
          ) : !list.length ? (
            <Empty icon={IC.search} title="No results" sub="Adjust your filters." t={t} />
          ) : (
            <>
              {pageList.map((s, i) => (
                <div key={i} className="ea-row" onClick={() => { setSel(s); setExpTab("why"); }}
                  style={{
                    padding: "11px 12px", borderBottom: "1px solid " + t.border,
                    background: (sel?.id) === s.id ? t.accentBg : "transparent",
                    borderLeft: "3px solid " + ((sel?.id) === s.id ? t.accent : "transparent"),
                  }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Avatar name={s.name} risk={s.risk} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.name || "Unknown Student"}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.id || "—"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                        <Badge risk={s.risk} sm />
                        <Sparkline trend={s.trend} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {totalPages > 1 && (
                <div style={{ padding: "10px 12px", borderTop: "1px solid " + t.border, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ padding: "4px 10px", background: "none", border: "1px solid " + t.border2, borderRadius: 6, color: page === 0 ? t.muted : t.textSub, fontSize: 12, cursor: page === 0 ? "not-allowed" : "pointer", fontWeight: 500 }}>
                    Prev
                  </button>
                  <span style={{ fontSize: 11, color: t.muted }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                    style={{ padding: "4px 10px", background: "none", border: "1px solid " + t.border2, borderRadius: 6, color: page === totalPages - 1 ? t.muted : t.textSub, fontSize: 12, cursor: page === totalPages - 1 ? "not-allowed" : "pointer", fontWeight: 500 }}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Selected student details panel ── */}
      {sel ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: t.bg }}>
          <div className="ea-slide">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <Avatar name={sel.name} risk={sel.risk} size={52} />
                <div>
                  <h2 style={{ fontSize: 19, fontWeight: 700, color: t.text }}>{sel.name || "Unknown Student"}</h2>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sel.id}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>{sel.programme} | Level {sel.level} | Semester {sel.semester}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setShowNote(true)} style={{ padding: "8px 14px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 8, color: t.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.note} size={13} color={t.accent} /> Log Intervention</button>
                <button onClick={() => setShowEdit(true)} style={{ padding: "8px 14px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Icon ic={IC.edit} size={13} color={t.textSub} /> Edit</button>
                <button onClick={() => setShowEmail(true)} style={{ padding: "8px 14px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.mail} size={14} color={t.textSub} /> Email</button>
                <button onClick={() => setShowFullProfile(true)} title="Open full profile screen" style={{ padding: "8px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Icon ic={IC.user} size={13} color="white" /> Full Profile</button>
                <button onClick={() => printReport(sel)} title="Print student report" style={{ padding: "8px 12px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, cursor: "pointer" }}><Icon ic={IC.print} size={14} color={t.textSub} /></button>
                <button onClick={() => { if (window.confirm("Remove " + sel.name + " from the registry? This cannot be undone.")) { deleteStudent(sel.id); } }} title="Remove student" style={{ padding: "8px 12px", background: "none", border: "1px solid " + t.dangerMuted, borderRadius: 8, color: t.danger, fontSize: 13, cursor: "pointer" }}><Icon ic={IC.trash} size={14} color={t.danger} /></button>
                <RiskGauge value={sel.risk} size={96} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
              {[
                { l: "GPA", v: (sel.gpa != null ? sel.gpa.toFixed(1) : "N/A"), pct: (sel.gpa || 0) / 4, col: (sel.gpa || 0) >= 3 ? t.safe : (sel.gpa || 0) >= 2 ? t.warn : t.danger, note: (sel.gpa || 0) < 2 ? "Below minimum" : "" },
                { l: "Attendance", v: (sel.attendance != null ? sel.attendance + "%" : "N/A"), pct: (sel.attendance || 0) / 100, col: (sel.attendance || 0) >= 80 ? t.safe : (sel.attendance || 0) >= 65 ? t.warn : t.danger, note: (sel.attendance || 0) < 65 ? "Below 65% threshold" : "" },
                { l: "Credits", v: (sel.credits || 0) + "/" + (sel.required || 90), pct: (sel.required ? sel.credits / sel.required : 0), col: (sel.required ? sel.credits / sel.required : 0) >= 0.9 ? t.safe : t.warn, note: (sel.required ? sel.credits / sel.required : 0) < 0.75 ? "Behind schedule" : "" },
              ].map(({ l, v, pct, col, note }, i) => (
                <Card key={i} style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, marginBottom: 5 }}>{l.toUpperCase()}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: col, marginBottom: 8 }}>{v}</div>
                  <Bar pct={pct} color={col} h={5} />
                  {note && <div style={{ fontSize: 11, color: col, marginTop: 5, fontWeight: 600 }}>{note}</div>}
                </Card>
              ))}
            </div>

            <div style={{
              padding: "16px 18px", background: rbg(sel.risk, t), borderRadius: 12,
              border: "1px solid " + rbrd(sel.risk, t), marginBottom: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: rc(sel.risk, t), marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>
                {rlbl(sel.risk)} - Advisor Summary
              </div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>{generateOverallSummary(sel)}</div>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: t.surface2, borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid " + t.border }}>
              {[
                { id: "why", lbl: "Why Was This Student Flagged?" },
                { id: "actions", lbl: "What Should the Advisor Do?" },
              ].map(({ id, lbl }) => (
                <button key={id} onClick={() => setExpTab(id)}
                  style={{
                    padding: "8px 18px", borderRadius: 7, border: "none", fontSize: 13,
                    fontWeight: expTab === id ? 700 : 500,
                    background: expTab === id ? t.surface : t.surface2,
                    color: expTab === id ? t.accent : t.muted,
                    cursor: "pointer", boxShadow: expTab === id ? t.shadow : "none",
                  }}>
                  {lbl}
                </button>
              ))}
            </div>

            {expTab === "why" && (
              <div style={{ marginBottom: 18 }}>
                <Card style={{ padding: "20px 22px", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Detailed Explanation of Risk Factors</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 18, lineHeight: 1.5 }}>
                    The sections below explain, in plain English, exactly what the AI model detected and why each factor contributes to this student's dropout risk score.
                  </div>
                  {(generateWhyFlagged(sel) || []).map(({ sev, text }, i) => {
                    const sevColor = { critical: t.danger, high: t.warn, mod: t.accent, low: t.safe }[sev];
                    const sevBg = { critical: t.dangerBg, high: t.warnBg, mod: t.accentBg, low: t.safeBg }[sev];
                    const sevBrd = { critical: t.dangerMuted, high: t.warnMuted, mod: t.accentMuted, low: t.safeMuted }[sev];
                    const sevLabel = { critical: "Critical Factor", high: "High Concern", mod: "Moderate Concern", low: "Positive Signal" }[sev];
                    return (
                      <div key={i} style={{ padding: "14px 16px", background: sevBg, borderRadius: 10, border: "1px solid " + sevBrd, marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: sevColor, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{sevLabel}</div>
                        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>{text}</div>
                      </div>
                    );
                  })}
                </Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Card style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>AI Model Factor Weights</div>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>How much each factor pushed the score up (red) or down (green)</div>
                    <ShapBar data={sel.shap} />
                  </Card>
                  <Card style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>GPA Trend Over Time</div>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>vs programme average (dashed line)</div>
                    <GpaTrend hist={sel.gpaHist || [null, null, null, sel.gpa]} avg={sel.progAvg || 0.45} />
                  </Card>
                </div>
              </div>
            )}

            {expTab === "actions" && (
              <div style={{ marginBottom: 18 }}>
                <Card style={{ padding: "20px 22px", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Recommended Actions for This Student</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 18, lineHeight: 1.5 }}>
                    These recommendations are generated based on this student's specific combination of risk factors. They are ordered by urgency.
                  </div>
                  {(generateRecommendedActions(sel) || []).map(({ priority, icon, title, detail }, i) => (
                    <div key={i} style={{
                      padding: "16px 18px", background: PRIORITY_BG[priority], borderRadius: 10,
                      border: "1px solid " + PRIORITY_COLORS[priority] + "33", marginBottom: 14,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          <Icon ic={IC[icon] || IC.note} size={20} color={PRIORITY_COLORS[priority]} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</div>
                            <span style={{
                              padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                              background: PRIORITY_COLORS[priority], color: "white", flexShrink: 0,
                            }}>
                              {PRIORITY_LABEL[priority]}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>{detail}</div>
                          <button onClick={() => setShowNote(true)} style={{
                            marginTop: 10, padding: "6px 14px", background: "none",
                            border: "1px solid " + PRIORITY_COLORS[priority], borderRadius: 7,
                            color: PRIORITY_COLORS[priority], fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>
                            Log this intervention
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>How This Student Compares</div>
                  {[
                    { lbl: "This student", val: sel.risk },
                    { lbl: "Programme average", val: sel.progAvg || 0.45 },
                    { lbl: "University average", val: 0.42 },
                  ].map(({ lbl, val }, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: t.textSub }}>{lbl}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: rc(val, t) }}>{Math.round(val * 100)}% risk</span>
                      </div>
                      <Bar pct={val} color={rc(val, t)} h={5} />
                    </div>
                  ))}
                </Card>
              </div>
            )}

            <Card style={{ padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Intervention History</div>
                <button onClick={() => setShowNote(true)} style={{
                  fontSize: 12, color: t.accent, background: t.accentBg,
                  border: "1px solid " + t.accentMuted, borderRadius: 7, padding: "5px 10px",
                  cursor: "pointer", fontWeight: 600,
                }}>
                  <Icon ic={IC.note} size={13} color={t.accent} /> Add note
                </button>
              </div>
              {(!sel.interventions || sel.interventions.length === 0) ? (
                <div style={{ padding: "14px 0", textAlign: "center", color: t.muted, fontSize: 13 }}>
                  No interventions logged yet. Use the buttons above to log your first note.
                </div>
              ) : (
                sel.interventions.map((iv, i) => (
                  <div key={i} style={{
                    padding: "11px 14px", background: t.surface2, borderRadius: 9,
                    border: "1px solid " + t.border, marginBottom: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>{iv.by || "Advisor"}</span>
                      <span style={{ fontSize: 11, color: t.muted, fontFamily: "monospace" }}>{iv.date}</span>
                    </div>
                    <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6 }}>{iv.note}</div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Empty icon={IC.user} title="Select a student" sub="Choose from the list to see their full risk profile and plain‑English explanation." t={t} />
        </div>
      )}
    </div>
  );
}