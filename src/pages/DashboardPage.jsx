import React, { useState } from "react";
import { useApp } from "../context";
import { Card, Badge, Avatar, Bar, Sparkline, Empty } from "../components/ui";
import { PieDonutChart, BarChartOv, HistogramOv, StackedBarChart } from "../components/ui";
import Icon, { IC } from "../components/icons";
import { rc, exportCohortReport } from "../utils";

export default function DashboardPage({ setActive, setSelStu, programmesList }) {
  const { t, students, wasCleared } = useApp();

  const [chartType, setChartType] = useState("bar");
  const [chartProg, setChartProg] = useState("All Programmes");
  const [chartLevel, setChartLevel] = useState("All Levels");
  const [chartSem, setChartSem] = useState("All Semesters");
  const [colors, setColors] = useState({ high: t.danger, moderate: t.warn, low: t.safe });
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Filter students for chart
  const filteredStudents = students.filter(s => {
    if (chartProg !== "All Programmes" && s.programme !== chartProg) return false;
    if (chartLevel !== "All Levels" && String(s.level) !== chartLevel) return false;
    if (chartSem !== "All Semesters" && String(s.semester) !== chartSem) return false;
    return true;
  });

  const high = filteredStudents.filter(s => s.risk >= 0.7);
  const mod = filteredStudents.filter(s => s.risk >= 0.4 && s.risk < 0.7);
  const low = filteredStudents.filter(s => s.risk < 0.4);
  const avg = filteredStudents.length
    ? filteredStudents.reduce((a, b) => a + b.risk, 0) / filteredStudents.length
    : 0;

  const stats = [
    { lbl: "Total Monitored", val: filteredStudents.length, sub: "This semester", icon: IC.students, col: t.accent },
    { lbl: "High Risk", val: high.length, sub: filteredStudents.length ? `${Math.round((high.length / filteredStudents.length) * 100)}% of filtered` : "0%", icon: IC.alert, col: colors.high },
    { lbl: "Moderate Risk", val: mod.length, sub: filteredStudents.length ? `${Math.round((mod.length / filteredStudents.length) * 100)}% of filtered` : "0%", icon: IC.analytics, col: colors.moderate },
    { lbl: "Avg Risk Score", val: `${Math.round(avg * 100)}%`, sub: "Across filtered programmes", icon: IC.predict, col: t.accent },
  ];

  const CHART_TYPES = [
    { id: "bar", lbl: "Bar", icon: IC.chart },
    { id: "pie", lbl: "Pie", icon: IC.analytics },
    { id: "donut", lbl: "Donut", icon: IC.activity },
    { id: "hist", lbl: "Histogram", icon: IC.predict },
    { id: "stacked", lbl: "Programme", icon: IC.trend },
  ];

  return (
    <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto", background: t.bg }}>
      {/* Print Full Report button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 10 }}>
        <button
          onClick={() => { try { exportCohortReport(students, { high: 70, mod: 40 }); } catch (e) { console.error("Report export failed:", e); } }}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: t.accent, border: "none", borderRadius: 8, color: "white",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}
        >
          <Icon ic={IC.print} size={14} color="white" /> Print Full Report
        </button>
      </div>

      {/* Stats cards */}
      <div className="ea-fade" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {stats.map((st, i) => (
          <Card key={i} hover style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, color: t.muted, fontWeight: 500, marginBottom: 6 }}>{st.lbl}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-.5px", lineHeight: 1 }}>{st.val}</div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 5 }}>{st.sub}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: st.col + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon ic={st.icon} size={18} color={st.col} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* No students or main content */}
      {!students.length ? (
        <Card>
          <Empty
            icon={IC.check}
            title={wasCleared ? "Dashboard cleared - ready for new data" : "No student data loaded yet"}
            sub={wasCleared ? "All previous student records have been removed." : "Upload a dataset from the Students page, or go to Predict and run a batch analysis."}
            action={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                <button onClick={() => setActive("predict")} style={{ padding: "9px 18px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  <Icon ic={IC.predict} size={13} color="white" /> Run Batch Prediction
                </button>
                <button onClick={() => setActive("students")} style={{ padding: "9px 18px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  <Icon ic={IC.upload} size={13} color={t.textSub} /> Upload CSV Dataset
                </button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="ea-fade1" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Students Needing Attention */}
            <Card>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Students Needing Attention</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Ranked by risk score</div>
                </div>
                <button onClick={() => setActive("students")} style={{ fontSize: 13, fontWeight: 600, color: t.accent, background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
                  View all
                </button>
              </div>
              {[...students].sort((a, b) => b.risk - a.risk).slice(0, 5).map((s, i) => (
                <div key={i} className="ea-row" onClick={() => { setSelStu(s); setActive("students"); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < 4 ? "1px solid " + t.border : "none" }}>
                  <Avatar name={s.name} risk={s.risk} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{s.name || "Unknown Student"}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>{s.programme || "-"} | Level {s.level || "-"}</div>
                  </div>
                  <Sparkline trend={s.trend} />
                  <Badge risk={s.risk} sm />
                </div>
              ))}
            </Card>

            {/* Risk Distribution Chart */}
            <Card style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Risk Distribution</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Filter and customize the chart</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={chartProg} onChange={e => setChartProg(e.target.value)} style={{ padding: "5px 8px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 6, fontSize: 12, color: t.textSub, cursor: "pointer" }}>
                    <option>All Programmes</option>
                    {programmesList.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select value={chartLevel} onChange={e => setChartLevel(e.target.value)} style={{ padding: "5px 8px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 6, fontSize: 12, color: t.textSub, cursor: "pointer" }}>
                    <option>All Levels</option>
                    {["100", "200", "300", "400"].map(l => <option key={l}>{l}</option>)}
                  </select>
                  <select value={chartSem} onChange={e => setChartSem(e.target.value)} style={{ padding: "5px 8px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 6, fontSize: 12, color: t.textSub, cursor: "pointer" }}>
                    <option>All Semesters</option>
                    {["1", "2"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setShowColorPicker(v => !v)} style={{ padding: "5px 8px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 6, fontSize: 12, color: t.textSub, cursor: "pointer" }}>
                    🎨 Colors
                  </button>
                </div>
              </div>
              {showColorPicker && (
                <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center", background: t.surface2, padding: "8px 12px", borderRadius: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>High <input type="color" value={colors.high} onChange={e => setColors(c => ({ ...c, high: e.target.value }))} style={{ width: 20, height: 20, border: "none", cursor: "pointer" }} /></label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>Moderate <input type="color" value={colors.moderate} onChange={e => setColors(c => ({ ...c, moderate: e.target.value }))} style={{ width: 20, height: 20, border: "none", cursor: "pointer" }} /></label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>Low <input type="color" value={colors.low} onChange={e => setColors(c => ({ ...c, low: e.target.value }))} style={{ width: 20, height: 20, border: "none", cursor: "pointer" }} /></label>
                  <button onClick={() => setColors({ high: t.danger, moderate: t.warn, low: t.safe })} style={{ marginLeft: "auto", fontSize: 12, color: t.accent, background: "none", border: "none", cursor: "pointer" }}>Reset</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, background: t.surface2, borderRadius: 9, padding: 4, border: "1px solid " + t.border, width: "fit-content" }}>
                {CHART_TYPES.map(({ id, lbl, icon }) => (
                  <button key={id} onClick={() => setChartType(id)} title={lbl + " chart"}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "none",
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: chartType === id ? t.surface : "transparent",
                      color: chartType === id ? t.accent : t.muted,
                      boxShadow: chartType === id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                      transition: "all .15s",
                    }}>
                    <Icon ic={icon} size={13} color={chartType === id ? t.accent : t.muted} />
                    <span>{lbl}</span>
                  </button>
                ))}
              </div>

              {/* Render selected chart */}
              {chartType === "bar" && <BarChartOv high={high.length} mod={mod.length} low={low.length} total={filteredStudents.length} colors={colors} />}
              {chartType === "pie" && <PieDonutChart high={high.length} mod={mod.length} low={low.length} total={filteredStudents.length} donut={false} colors={colors} />}
              {chartType === "donut" && <PieDonutChart high={high.length} mod={mod.length} low={low.length} total={filteredStudents.length} donut={true} colors={colors} />}
              {chartType === "hist" && <HistogramOv students={filteredStudents} colors={colors} />}
              {chartType === "stacked" && <StackedBarChart students={filteredStudents} programmesList={programmesList} colors={colors} />}
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>By Programme</div>
              {programmesList.filter(p => p !== "All Programmes").map(prog => {
                const ps = students.filter(s => s.programme === prog);
                if (!ps.length) return null;
                const pa = ps.reduce((a, b) => a + b.risk, 0) / ps.length;
                return (
                  <div key={prog} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: t.textSub }}>{prog}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: rc(pa, t) }}>{Math.round(pa * 100)}%</span>
                    </div>
                    <Bar pct={pa} color={rc(pa, t)} />
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 3 }}>{ps.length} students</div>
                  </div>
                );
              })}
            </Card>
            {high.length > 0 && (
              <div style={{ padding: "14px 16px", background: t.dangerBg, borderRadius: 10, border: "1px solid " + t.dangerMuted }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.danger, marginBottom: 5 }}>Action Required</div>
                <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.55 }}>{high.length} student{high.length > 1 ? "s are" : " is"} at high risk. Review their profiles and log interventions.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}