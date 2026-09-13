import React, { useState, useEffect } from "react";
import { useApp } from "../context";
import { Card, Badge, Spinner, Empty } from "../components/ui";
import Icon, { IC } from "../components/icons";
import { rc, exportCohortReport } from "../utils";
import { apiFetch } from "../utils";

export default function AnalyticsPage() {
  const { t, students, programmesList } = useApp();
  const [hov, setHov] = useState(null);
  const [cohortData, setCohortData] = useState(null);
  const [histData, setHistData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const thresh = { high: 70, mod: 40 };

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [cohort, hist] = await Promise.all([
          apiFetch("/analytics/cohort"),
          apiFetch("/analytics/predictions-history?days=30"),
        ]);
        setCohortData(cohort);
        setHistData(hist);
      } catch (e) {
        console.warn("Analytics backend not available:", e.message);
      } finally {
        setLoadingAnalytics(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loadingAnalytics) {
    return (
      <div style={{ flex: 1, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={40} color={t.accent} />
      </div>
    );
  }

  if (!students.length) {
    return (
      <div style={{ flex: 1, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty icon={IC.analytics} title="No data" sub="Upload a student dataset to see analytics." t={t} />
      </div>
    );
  }

  const programmes = programmesList || [];
  const PS = cohortData
    ? cohortData.map(d => ({ prog: d.programme, avg: d.avg_risk, count: d.count, high: d.high }))
    : programmes.map(prog => {
        const ps = students.filter(s => s.programme === prog);
        return {
          prog,
          avg: ps.length ? ps.reduce((a, b) => a + b.risk, 0) / ps.length : 0,
          count: ps.length,
          high: ps.filter(s => s.risk >= thresh.high / 100).length,
        };
      });

  const trendMonths = histData && histData.length ? histData : [];
  if (!trendMonths.length) {
    return (
      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto", background: t.bg }}>
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <Empty icon={IC.chart} title="No trend data" sub="The backend has not yet collected enough historical data to display monthly trends." t={t} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto", background: t.bg }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => exportCohortReport(students, thresh)} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 18px",
          background: t.accent, border: "none", borderRadius: 8, color: "white",
          fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,.25)",
        }}>
          <Icon ic={IC.download} size={14} color="white" /> Export Full Cohort Report
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3 }}>Risk Distribution</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 18 }}>Hover a bar to see student details</div>
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 110 }}>
            {[...students].sort((a, b) => b.risk - a.risk).map((s, i) => (
              <div key={i} onMouseEnter={() => setHov(s)} onMouseLeave={() => setHov(null)} style={{ flex: 1, cursor: "pointer" }}>
                <div style={{
                  width: "100%", height: s.risk * 100 + "px",
                  background: (hov && hov.id) === s.id ? t.text : rc(s.risk, t),
                  borderRadius: "4px 4px 0 0", transition: "all .15s",
                  opacity: hov && hov.id !== s.id ? 0.3 : 1,
                }} />
              </div>
            ))}
          </div>
          {hov ? (
            <div style={{ marginTop: 10, padding: "9px 12px", background: t.surface2, borderRadius: 8, fontSize: 13 }}>
              <strong style={{ color: t.text }}>{hov.name}</strong> - <strong style={{ color: rc(hov.risk, t) }}>{Math.round(hov.risk * 100)}%</strong> | {hov.programme}
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", gap: 14 }}>
              {[["High", t.danger], ["Moderate", t.warn], ["Low", t.safe]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                  <span style={{ fontSize: 11, color: t.muted }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3 }}>Programme Summary</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 18 }}>Average risk and student counts</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Programme", "Total", "High", "Risk"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 600, color: t.muted, textAlign: "left", paddingBottom: 10, borderBottom: "1px solid " + t.border }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PS.sort((a, b) => b.avg - a.avg).map(({ prog, avg, count, high }, i) => (
                <tr key={i}>
                  <td style={{ padding: "9px 0", fontSize: 13, color: t.textSub, borderBottom: "1px solid " + t.border }}>{prog}</td>
                  <td style={{ padding: "9px 0", fontSize: 13, color: t.muted, borderBottom: "1px solid " + t.border }}>{count}</td>
                  <td style={{ padding: "9px 0", fontSize: 13, color: t.danger, fontWeight: 600, borderBottom: "1px solid " + t.border }}>{high}</td>
                  <td style={{ padding: "9px 0", borderBottom: "1px solid " + t.border }}>{avg > 0 && <Badge risk={avg} sm />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Monthly Risk Trend by Programme</div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Average dropout risk (%)</div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {programmes.map((prog, idx) => (
              <div key={prog} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 3, background: [t.accent, t.warn, t.safe, t.danger][idx % 4], borderRadius: 2 }} />
                <span style={{ fontSize: 12, color: t.muted }}>{prog.slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </div>
        <svg width="100%" height="160" viewBox="0 0 680 160" preserveAspectRatio="xMidYMid meet">
          {[0, 20, 40].map((v, i) => (
            <g key={i}>
              <line x1="44" y1={138 - v * 2.5} x2="680" y2={138 - v * 2.5} stroke={t.border} strokeWidth="1" />
              <text x="36" y={142 - v * 2.5} fill={t.muted} fontSize="10" textAnchor="end" fontFamily="Plus Jakarta Sans,sans-serif">{v}</text>
            </g>
          ))}
        </svg>
      </Card>
    </div>
  );
}