import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context";
import Icon, { IC } from "./icons";
import { apiFetch } from "../utils";

export default function Topbar({ title, sub, onRefresh, refreshing, unreadCount = 0, onNotifClick, academicYear, semester, setAcademicYear, setSemester }) {
  const { t, lastUpdated } = useApp();
  const [editingAcad, setEditingAcad] = useState(false);
  const [acadDraft, setAcadDraft] = useState(academicYear || "");
  const [semDraft, setSemDraft] = useState(semester || "");
  const acadRef = useRef();
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    async function checkHealth() {
      try { await apiFetch("/health"); setBackendOk(true); }
      catch { setBackendOk(false); }
    }
    checkHealth();
    const iv = setInterval(checkHealth, 30000);
    return () => clearInterval(iv);
  }, []);

  const fmtTime = d => d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " | " + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null;

  return (
    <header style={{ height: 56, borderBottom: "1px solid " + t.border, background: t.surface, display: "flex", alignItems: "center", padding: "0 28px", justifyContent: "space-between", flexShrink: 0 }}>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</div>
        {sub && (
          <div style={{ fontSize: 11, color: t.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
            {sub}
            {academicYear && semester && (
              <>
                <span>|</span>
                <button
                  onClick={() => { setAcadDraft(academicYear); setSemDraft(semester); setEditingAcad(true); setTimeout(() => acadRef.current && acadRef.current.focus(), 50); }}
                  style={{ fontSize: 11, color: t.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, display: "inline-flex", alignItems: "center", gap: 3 }}
                >
                  {academicYear} | {semester}
                  <Icon ic={IC.edit} size={10} color={t.accent} />
                </button>
              </>
            )}
          </div>
        )}
        {editingAcad && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, background: t.surface, border: "1px solid " + t.border, borderRadius: 10, padding: "14px 16px", boxShadow: "0 8px 24px rgba(0,0,0,.15)", zIndex: 500, display: "flex", flexDirection: "column", gap: 10, minWidth: 280 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 2 }}>Edit Academic Period</div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: t.muted, display: "block", marginBottom: 4 }}>Academic Year</label>
              <input ref={acadRef} value={acadDraft} onChange={e => setAcadDraft(e.target.value)} placeholder="e.g. 2024/2025" style={{ width: "100%", padding: "7px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 7, color: t.text, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: t.muted, display: "block", marginBottom: 4 }}>Semester</label>
              <select value={semDraft} onChange={e => setSemDraft(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 7, color: t.text, fontSize: 13, cursor: "pointer" }}>
                {["Semester 1", "Semester 2", "Trimester 1", "Trimester 2", "Trimester 3"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <button onClick={() => { setAcademicYear && setAcademicYear(acadDraft); setSemester && setSemester(semDraft); setEditingAcad(false); }} style={{ flex: 1, padding: "7px 0", background: t.accent, border: "none", borderRadius: 7, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditingAcad(false)} style={{ flex: 1, padding: "7px 0", background: "none", border: "1px solid " + t.border2, borderRadius: 7, color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: t.surface2, border: "1px solid " + t.border }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: backendOk === null ? t.warn : backendOk ? t.safe : t.danger, transition: "background .3s" }} />
          <span style={{ fontSize: 12, color: t.muted }}>{backendOk === null ? "Connecting..." : backendOk ? "ML Model active" : "Backend unreachable"}</span>
        </div>
        {lastUpdated && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: t.surface2, borderRadius: 6, border: "1px solid " + t.border }}>
            <Icon ic={IC.clock} size={12} color={t.muted} />
            <span style={{ fontSize: 11, color: t.muted }}>Updated</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textSub }}>{fmtTime(lastUpdated)}</span>
          </div>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={refreshing} title="Re-run predictions" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", background: refreshing ? t.surface2 : t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 7, color: refreshing ? t.muted : t.accent, fontSize: 12, fontWeight: 600, cursor: refreshing ? "not-allowed" : "pointer", transition: "all .15s" }}>
            <span style={{ display: "inline-flex", animation: refreshing ? "spin .7s linear infinite" : "none" }}><Icon ic={IC.refresh} size={13} color={refreshing ? t.muted : t.accent} /></span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
        <button onClick={onNotifClick} style={{ position: "relative", width: 36, height: 36, borderRadius: 8, background: unreadCount > 0 ? t.dangerBg : "none", border: "1px solid " + (unreadCount > 0 ? t.dangerMuted : t.border2), display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
          <Icon ic={IC.bell} size={16} color={unreadCount > 0 ? t.danger : t.muted} />
          {unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: t.danger, color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + t.surface }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>
      </div>
    </header>
  );
}