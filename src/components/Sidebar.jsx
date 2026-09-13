import React from "react";
import { useApp } from "../context";
import Icon, { IC } from "./icons";

const NAV = [
  { id: "dashboard", lbl: "Overview", icon: IC.dash },
  { id: "students", lbl: "Students", icon: IC.students },
  { id: "analytics", lbl: "Analytics", icon: IC.analytics },
  { id: "predict", lbl: "Predict", icon: IC.predict },
  { id: "settings", lbl: "Settings", icon: IC.settings },
];

export default function Sidebar({ active, setActive, onLogout, onClear }) {
  const { t, dark, setDark, students, user } = useApp();
  const studentCount = students.length;
  const sidebarAvatar = user?.photo ? (
    <img src={user.photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
  ) : (
    <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>
      {((user?.name || "Academic Advisor").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase())}
    </div>
  );

  return (
    <aside style={{ width: 220, flexShrink: 0, background: t.sidebar, borderRight: "1px solid " + t.border, display: "flex", flexDirection: "column", padding: "18px 10px" }}>
      <div style={{ padding: "6px 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon ic={IC.logo} size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>EduAlert</div>
          <div style={{ fontSize: 10, color: t.muted }}>UENR | 2024/25 S2</div>
        </div>
      </div>
      <div style={{ padding: "0 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11, color: t.muted }}>Home</span>
        <Icon ic={IC.chevR} size={10} color={t.muted} />
        <span style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>{(NAV.find(n => n.id === active) || {}).lbl}</span>
      </div>
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, padding: "0 10px", marginBottom: 4, letterSpacing: ".07em" }}>NAVIGATION</div>
        {NAV.map(({ id, lbl, icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className="ea-nav"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8,
                border: "none", width: "100%", textAlign: "left",
                background: isActive ? t.accentBg : "transparent",
                color: isActive ? t.accent : t.textSub,
                fontWeight: isActive ? 600 : 500, fontSize: 14,
                borderLeft: "3px solid " + (isActive ? t.accent : "transparent"),
                cursor: "pointer",
              }}
            >
              <Icon ic={icon} size={16} color={isActive ? t.accent : t.textSub} />
              {lbl}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid " + t.border, paddingTop: 12 }}>
        <button onClick={() => setDark(d => !d)} className="ea-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "none", width: "100%", background: "transparent", color: t.textSub, fontWeight: 500, fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
          <Icon ic={dark ? IC.sun : IC.moon} size={15} color={t.textSub} />
          {dark ? "Light mode" : "Dark mode"}
        </button>
        {studentCount > 0 && (
          <button onClick={onClear} className="ea-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "none", width: "100%", background: "transparent", color: t.warn, fontWeight: 500, fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
            <Icon ic={IC.trash} size={15} color={t.warn} /> Clear Data ({studentCount})
          </button>
        )}
        <button onClick={onLogout} className="ea-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "none", width: "100%", background: "transparent", color: t.danger, fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
          <Icon ic={IC.logout} size={15} color={t.danger} /> Sign Out
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderTop: "1px solid " + t.border, paddingTop: 10, marginTop: 4 }}>
          {sidebarAvatar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(user && user.name) || "Advisor"}</div>
            <div style={{ fontSize: 10, color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(user && user.email) || "advisor@uenr.edu.gh"}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}