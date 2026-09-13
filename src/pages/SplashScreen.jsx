import React, { useState, useEffect } from "react";
import Icon, { IC } from "../components/icons";

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const T = [800, 200, 500, 500, 800];
    let acc = 0;
    T.forEach((d, i) => { acc += d; setTimeout(() => setPhase(i + 1), acc); });
    setTimeout(onDone, T.reduce((a, b) => a + b, 0) + 120);
    let frame;
    const spinnerStart = T[0] + T[1] + T[2];
    const spinnerDur = T[3];
    setTimeout(() => {
      const t0 = performance.now();
      function tick() {
        const elapsed = performance.now() - t0;
        const linear = Math.min(1, elapsed / spinnerDur);
        const eased = linear < 0.5 ? 2 * linear * linear : 1 - Math.pow(-2 * linear + 2, 2) / 2;
        setPct(Math.round(eased * 100));
        if (elapsed < spinnerDur) { frame = requestAnimationFrame(tick); }
      }
      frame = requestAnimationFrame(tick);
    }, spinnerStart);
    return () => { if (frame) cancelAnimationFrame(frame); };
  }, [onDone]);

  const slideOut = phase >= 5;
  const FEATURES = [
    { ic: IC.brain, text: "Explainable AI predictions" },
    { ic: IC.analytics, text: "Real-time risk monitoring" },
    { ic: IC.note, text: "Plain-English advisor guidance" },
    { ic: IC.shield, text: "Secure & UENR-specific" },
  ];
  const R = 42, C = 2 * Math.PI * R;
  const dashOffset = C - (pct / 100) * C;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(135deg,#1e3a8a 0%,#2563EB 55%,#0ea5e9 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transition: "transform .7s cubic-bezier(.77,0,.18,1), opacity .65s ease",
      transform: slideOut ? "translateY(-100%)" : "translateY(0)", opacity: slideOut ? 0 : 1,
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -120, right: -120, width: 420, height: 420, borderRadius: "50%", background: "rgba(255,255,255,.05)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "20%", left: "8%", width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />
      <div style={{
        width: 92, height: 92, borderRadius: 26, background: "rgba(255,255,255,.14)", backdropFilter: "blur(14px)",
        border: "1.5px solid rgba(255,255,255,.28)", display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 22, transition: "transform .65s cubic-bezier(.34,1.56,.64,1), opacity .5s ease",
        transform: phase >= 1 ? "scale(1)" : "scale(0.3)", opacity: phase >= 1 ? 1 : 0,
        boxShadow: "0 20px 60px rgba(0,0,0,.25)", color: "white",
      }}>
        <Icon ic={IC.logo} size={44} color="white" />
      </div>
      <div style={{
        fontSize: 44, fontWeight: 800, color: "white", letterSpacing: "-1.5px",
        transition: "transform .5s ease, opacity .5s ease",
        transform: phase >= 1 ? "translateY(0)" : "translateY(24px)", opacity: phase >= 1 ? 1 : 0,
        fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 8,
        textShadow: "0 2px 20px rgba(0,0,0,.2)",
      }}>
        EduAlert
      </div>
      <div style={{
        fontSize: 15, color: "rgba(255,255,255,.72)",
        transition: "transform .5s .1s ease, opacity .5s .1s ease",
        transform: phase >= 1 ? "translateY(0)" : "translateY(18px)", opacity: phase >= 1 ? 1 : 0,
        fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 12,
      }}>
        Student Dropout Risk Prediction System
      </div>
      <div style={{
        padding: "5px 16px", borderRadius: 20, background: "rgba(255,255,255,.1)",
        border: "1px solid rgba(255,255,255,.18)", fontSize: 11, color: "rgba(255,255,255,.82)",
        fontWeight: 500, marginBottom: 44, letterSpacing: ".06em", textTransform: "uppercase",
        transition: "opacity .4s .2s ease", opacity: phase >= 1 ? 1 : 0,
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}>
        UENR | Group 27 | Final Year Project 2026
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 520, marginBottom: 52 }}>
        {FEATURES.map(({ ic, text }, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 20,
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.17)",
            fontSize: 13, color: "white", fontWeight: 500,
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            transition: `transform .45s ${0.08 + i * 0.09}s cubic-bezier(.34,1.4,.64,1), opacity .4s ${0.08 + i * 0.09}s ease`,
            transform: phase >= 2 ? "translateY(0) scale(1)" : "translateY(24px) scale(0.88)",
            opacity: phase >= 2 ? 1 : 0,
          }}>
            <Icon ic={ic} size={14} color="rgba(255,255,255,.9)" />
            {text}
          </div>
        ))}
      </div>
      <div style={{ opacity: phase >= 3 ? 1 : 0, transition: "opacity .4s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", width: 108, height: 108 }}>
          <svg width={108} height={108} style={{ position: "absolute", inset: 0 }} viewBox="0 0 108 108">
            <circle cx={54} cy={54} r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={7} />
          </svg>
          <svg width={108} height={108} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} viewBox="0 0 108 108">
            <circle cx={54} cy={54} r={R} fill="none" stroke="white" strokeWidth={7} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset .08s linear", filter: "drop-shadow(0 0 8px rgba(255,255,255,.6))" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: "-1px", fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>{pct}%</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: ".04em" }}>
          {pct < 30 ? "Initialising model..." : pct < 60 ? "Loading student data..." : pct < 90 ? "Preparing dashboard..." : "Ready!"}
        </div>
      </div>
    </div>
  );
}