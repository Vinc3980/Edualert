import React, { useState, useEffect } from "react";
import { useApp } from "../context";
import Icon, { IC } from "../components/icons";

export default function WelcomeScreen({ onEnter, onGoStudents }) {
  const { t, user, toastList } = useApp();
  const [phase, setPhase] = useState(0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name || "Advisor").split(" ")[0];
  const unreadCount = toastList.filter(n => !n.read).length;

  useEffect(() => {
    [200, 600, 1000, 1400].forEach((d, i) => setTimeout(() => setPhase(i + 1), d));
  }, []);

  const anim = (ph, delay = 0) => ({
    opacity: phase >= ph ? 1 : 0,
    transform: phase >= ph ? "translateY(0)" : "translateY(16px)",
    transition: `all .5s ${delay}s cubic-bezier(.22,1,.36,1)`,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "38%", background: `linear-gradient(160deg,${t.accent}22,${t.accent}0a)`, borderRight: "1px solid " + t.border, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: t.accent + "08" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: t.accent + "06" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", padding: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: t.accentBg, border: "1.5px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon ic={IC.logo} size={40} color={t.accent} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 6, color: t.text }}>EduAlert</div>
          <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>University of Energy<br />& Natural Resources</div>
          <div style={{ marginTop: 24, padding: "6px 16px", borderRadius: 20, background: t.surface2, border: "1px solid " + t.border, fontSize: 11, color: t.muted, display: "inline-block", letterSpacing: ".05em" }}>UENR | Group 27 | 2026</div>
        </div>
      </div>

      <div style={{ marginLeft: "38%", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px", maxWidth: 580 }}>
        <div style={{ ...anim(1), fontSize: 15, color: t.muted, fontWeight: 500, marginBottom: 8 }}>{greeting}</div>
        <div style={{ ...anim(1, .08), fontSize: 36, fontWeight: 800, color: t.text, letterSpacing: "-1.2px", lineHeight: 1.15, marginBottom: 10 }}>
          Welcome back,<br /><span style={{ color: t.accent }}>{user?.title ? user.title + " " : ""}{firstName}</span>
        </div>
        <div style={{ ...anim(2, .06), fontSize: 14, color: t.muted, marginBottom: 24 }}>{user?.dept || "Faculty of Sciences"} | EduAlert Academic Dashboard</div>

        <div style={{ ...anim(3, .08), display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: unreadCount > 0 ? 20 : 28 }}>
          {[
            { lbl: "Students monitored", val: "0", icon: IC.students, col: t.accent },
            { lbl: "Alerts today", val: String(unreadCount), icon: IC.alert, col: unreadCount > 0 ? t.danger : t.muted },
            { lbl: "System status", val: "Active", icon: IC.activity, col: t.safe },
          ].map(({ lbl, val, icon, col }, i) => (
            <div key={i} style={{ padding: "16px 14px", background: t.surface, border: "1px solid " + t.border, borderRadius: 12, boxShadow: t.shadow }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: col + "12", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Icon ic={icon} size={15} color={col} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: col, marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {unreadCount > 0 && (
          <div style={{ ...anim(3, .12), marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Alerts requiring attention</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {toastList.slice(0, 3).map((n, i) => {
                const col = { danger: t.danger, warn: t.warn, info: t.accent }[n.type] || t.muted;
                const bg = { danger: t.dangerBg, warn: t.warnBg, info: t.accentBg }[n.type] || t.surface2;
                return (
                  <div key={i} style={{ padding: "10px 14px", background: bg, borderRadius: 10, border: "1px solid " + col + "20", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Icon ic={IC.alert} size={14} color={col} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>{n.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ ...anim(4, .06), display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={onEnter} style={{ padding: "13px 28px", background: t.accent, border: "none", borderRadius: 12, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: `0 4px 20px ${t.accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon ic={IC.dash} size={16} color="white" /> Enter Dashboard <Icon ic={IC.chevR} size={14} color="white" />
          </button>
          {unreadCount > 0 && (
            <button onClick={onGoStudents} style={{ padding: "13px 20px", background: t.dangerBg, border: "1.5px solid " + t.dangerMuted, borderRadius: 12, color: t.danger, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon ic={IC.alert} size={16} color={t.danger} /> View {unreadCount} Alert{unreadCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div style={{ ...anim(4, .1), marginTop: 14, fontSize: 12, color: t.muted }}>Signed in as <strong style={{ color: t.textSub }}>{(user && user.email) || "advisor@uenr.edu.gh"}</strong></div>
      </div>
    </div>
  );
}