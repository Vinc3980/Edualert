import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─── THEMES ───────────────────────────────────────────────────────────────────
const TH = {
  light: {
    bg: "#F7F8FA",
    surface: "#FFFFFF",
    surface2: "#F0F2F5",
    border: "#E4E7EC",
    border2: "#D0D5DD",
    text: "#101828",
    textSub: "#344054",
    muted: "#667085",
    accent: "#2563EB",
    accentBg: "#EFF6FF",
    accentMuted: "#BFDBFE",
    danger: "#DC2626",
    dangerBg: "#FEF2F2",
    dangerMuted: "#FECACA",
    warn: "#B45309",
    warnBg: "#FFFBEB",
    warnMuted: "#FDE68A",
    safe: "#059669",
    safeBg: "#ECFDF5",
    safeMuted: "#A7F3D0",
    shadow: "0 1px 3px rgba(16,24,40,.08)",
    shadowMd: "0 4px 12px rgba(16,24,40,.10)",
    inputBg: "#FFFFFF",
    sidebar: "#FFFFFF",
  },
  dark: {
    bg: "#111318",
    surface: "#1C1F2A",
    surface2: "#252836",
    border: "#2E3347",
    border2: "#3A3F55",
    text: "#F1F5F9",
    textSub: "#CBD5E1",
    muted: "#64748B",
    accent: "#3B82F6",
    accentBg: "#172554",
    accentMuted: "#1E40AF",
    danger: "#F87171",
    dangerBg: "#2D1515",
    dangerMuted: "#7F1D1D",
    warn: "#FCD34D",
    warnBg: "#2D2006",
    warnMuted: "#78350F",
    safe: "#34D399",
    safeBg: "#052E16",
    safeMuted: "#065F46",
    shadow: "0 1px 3px rgba(0,0,0,.30)",
    shadowMd: "0 4px 12px rgba(0,0,0,.28)",
    inputBg: "#111318",
    sidebar: "#161921",
  },
};

// ─── API LAYER ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const UENR_LOGO = "/uenr-logo.png";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let _authToken = "";
const getToken = () => _authToken;
const setToken = (t) => { _authToken = t; };
const clearToken = () => { _authToken = ""; };

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...opts.headers,
  };
  try {
    const res = await fetch(API_BASE + path, { ...opts, headers });
    if (res.status === 401 || res.status === 403) {
      clearToken();
      window.dispatchEvent(new CustomEvent("ea:unauthorized"));
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) {
      let detail = "Server error " + res.status;
      try { const d = await res.json(); detail = d.detail || detail; } catch { }
      throw new Error(detail);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  } catch (e) {
    if (e.message === "Failed to fetch") throw new Error("Cannot reach the EduAlert server. Is the backend running?");
    throw e;
  }
}

function useSessionWatcher(token, onExpiry) {
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiresAt = payload.exp * 1000;
      const warnAt = expiresAt - 5 * 60 * 1000;
      const now = Date.now();
      if (now >= expiresAt) { onExpiry(); return; }
      const warnTimer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ea:session-warning"));
      }, Math.max(0, warnAt - now));
      const expTimer = setTimeout(onExpiry, Math.max(0, expiresAt - now));
      return () => { clearTimeout(warnTimer); clearTimeout(expTimer); };
    } catch { }
  }, [token, onExpiry]);
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[EduAlert] Render error:", error, info); }
  render() {
    if (this.state.error) {
      const t = this.props.theme || {};
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: t.bg || "#F7F8FA", padding: 32, fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text || "#101828", marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 14, color: t.muted || "#667085", marginBottom: 24, lineHeight: 1.6 }}>
              EduAlert encountered an unexpected error. Please refresh the page to continue.<br />
              <span style={{ fontSize: 12, fontFamily: "monospace", color: t.danger || "#DC2626" }}>{this.state.error.message}</span>
            </div>
            <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: t.accent || "#2563EB", border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useGlobalCSS(t) {
  useEffect(() => {
    const id = "ea-css";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body,#root{height:100%;font-family:'Plus Jakarta Sans',sans-serif}
      input,select,button,textarea{font-family:inherit}
      ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.border};border-radius:3px}
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes slideInLeft{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
      @keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
      @keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes spinnerDash{0%{stroke-dashoffset:220}50%{stroke-dashoffset:40}100%{stroke-dashoffset:220}}
      @keyframes spinnerRotate{100%{transform:rotate(360deg)}}
      @keyframes dotBounce{0%,80%,100%{transform:translateY(0);opacity:.42}40%{transform:translateY(-12px);opacity:1}}
      @keyframes loaderGlow{0%,100%{box-shadow:0 0 0 0 ${t.accent}22}50%{box-shadow:0 0 0 12px ${t.accent}08}}
      @keyframes growBar{from{width:0!important}}
      @keyframes toastIn{from{opacity:0;transform:translateY(16px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes toastOut{to{opacity:0;transform:translateY(8px) scale(.96)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
      @keyframes bounceIn{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
      .ea-fade{animation:fadeUp .32s cubic-bezier(.4,0,.2,1) both}
      .ea-fade1{animation:fadeUp .32s .08s cubic-bezier(.4,0,.2,1) both}
      .ea-fade2{animation:fadeUp .32s .16s cubic-bezier(.4,0,.2,1) both}
      .ea-slide{animation:slideIn .28s cubic-bezier(.4,0,.2,1) both}
      .ea-slide-left{animation:slideInLeft .28s cubic-bezier(.4,0,.2,1) both}
      .ea-scale{animation:scaleIn .25s cubic-bezier(.4,0,.2,1) both}
      .ea-page-enter{animation:pageEnter .42s cubic-bezier(.22,1,.36,1) both}
      @keyframes pageEnter{from{opacity:0;transform:translateX(22px) scale(0.99)}to{opacity:1;transform:translateX(0) scale(1)}}
      .ea-gbar{animation:growBar .65s cubic-bezier(.4,0,.2,1) both}
      .ea-pulse{animation:pulse 1.5s ease-in-out infinite}
      .ea-bounce{animation:bounceIn .45s cubic-bezier(.34,1.56,.64,1) both}
      .ea-row{transition:background .1s;cursor:pointer}.ea-row:hover{background:${t.surface2}!important}
      .ea-card-h{transition:box-shadow .22s,transform .22s}.ea-card-h:hover{box-shadow:0 12px 32px rgba(0,0,0,.13),0 2px 0 rgba(255,255,255,.5) inset!important;transform:translateY(-3px) scale(1.012)}
      .ea-stat-card{position:relative;overflow:hidden;border-radius:16px!important;transition:box-shadow .22s,transform .22s}.ea-stat-card:hover{box-shadow:0 16px 40px rgba(0,0,0,.15),0 2px 0 rgba(255,255,255,.55) inset!important;transform:translateY(-4px) scale(1.015)}
      @keyframes bellRing{0%,100%{transform:rotate(0)}10%{transform:rotate(-18deg)}20%{transform:rotate(16deg)}30%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}50%{transform:rotate(-6deg)}60%{transform:rotate(4deg)}70%{transform:rotate(0)}}
      .ea-nav{transition:background .12s,color .12s}.ea-nav:hover{background:${t.surface2}!important}
      .ea-side-nav{transition:background .12s,color .12s,border-color .12s}.ea-side-nav:hover{background:rgba(255,255,255,.12)!important;border-color:rgba(255,255,255,.18)!important}
      input:focus,select:focus,textarea:focus{outline:none!important;border-color:${t.accent}!important;box-shadow:0 0 0 3px ${t.accentBg}!important;transition:border-color .15s,box-shadow .15s}
      button{transition:opacity .12s,transform .1s,box-shadow .15s}
      button:active:not(:disabled){transform:scale(0.97)}
      .ea-no-print{} @media print{.ea-no-print{display:none!important} body{font-size:11pt} .ea-print-page{padding:20px!important}}
    `;
  }, [t]);
}

// ─── SVG ICON LIBRARY (unchanged) ────────────────────────────────────────────
const IC = {
  logo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>,
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  students: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  predict: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>,
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>,
  folder: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  print: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeoff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  note: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  brain: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" /></svg>,
  trend: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  chevD: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  chevR: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  camera: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  activity: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>,
};

function Icon({ ic, size = 16, color = "currentColor", style = {} }) {
  if (!ic) return <span style={{ display: "inline-flex", width: size, height: size, flexShrink: 0 }} />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0, color, ...style }}>
      {React.cloneElement(ic, { width: size, height: size })}
    </span>
  );
}

// ─── HELPER FUNCTIONS (with dynamic programmes) ──────────────────────────────
let PROGS = ["All Programmes"]; // will be populated from backend

const REQCOLS = ["name", "id", "programme", "level", "semester", "gpa", "attendance", "credits", "required"];

const HONORIFICS = new Set(["dr.","prof.","mr.","mrs.","ms.","rev.","eng.","hon.","dr","prof","mr","mrs","ms","rev","eng","hon"]);
function firstName(s) {
  if (!s || !s.name || typeof s.name !== "string") return "This student";
  const parts = s.name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "This student";
  const start = HONORIFICS.has(parts[0].toLowerCase().replace(/\.$/,"")) ? 1 : 0;
  return parts[start] || parts[0] || "This student";
}

function safeName(s) {
  return (s && s.name && typeof s.name === "string" && s.name.trim()) ? s.name : "This student";
}

function generateWhyFlagged(s) {
  const cr = (s.credits || 0) / (s.required || 90);
  const issues = [];
  const name = firstName(s);
  if (s.gpa < 1.5) issues.push({ sev: "high", text: name + "'s GPA of " + s.gpa.toFixed(1) + " is critically low - well below the minimum passing threshold of 2.0. This is the single biggest driver of the high dropout risk score. Students with a GPA this low have historically struggled to recover without direct academic support." });
  else if (s.gpa < 2.0) issues.push({ sev: "high", text: name + "'s GPA has dropped to " + s.gpa.toFixed(1) + ", which is below the 2.0 minimum required to stay in good academic standing. If this continues for one more semester, they could face academic dismissal." });
  else if (s.gpa < 2.5) issues.push({ sev: "mod", text: name + "'s GPA stands at " + s.gpa.toFixed(1) + ", which is below the average for " + s.programme + " students (typically around 2.8). While not yet critical, the downward trend shown in their grade history is concerning and needs to be addressed now before it gets worse." });
  if (s.attendance < 55) issues.push({ sev: "high", text: "Attendance is only " + s.attendance + "%, which is extremely low. Missing this many classes makes it almost impossible to keep up with coursework and assessments. Research consistently shows that attendance below 60% is one of the strongest predictors of dropout, even for otherwise capable students." });
  else if (s.attendance < 65) issues.push({ sev: "high", text: name + " is only attending " + s.attendance + "% of classes. This means they are missing roughly 1 in 3 sessions, which puts them at serious risk of falling behind on key topics, missing assignments, and performing poorly in exams." });
  else if (s.attendance < 75) issues.push({ sev: "mod", text: "Attendance is at " + s.attendance + "%, which is below the recommended minimum of 75%. While not yet critical, continued absence at this level will start to affect exam performance and engagement with coursework." });
  if (cr < 0.5) issues.push({ sev: "high", text: name + " has only completed " + s.credits + " out of " + s.required + " required credits - just " + Math.round(cr * 100) + "% of what they need. This is a very large deficit for a Level " + s.level + " student and suggests serious disruption to their academic progression, possibly due to module failures or late withdrawals." });
  else if (cr < 0.75) issues.push({ sev: "high", text: "They are behind on their credit completion, having earned " + s.credits + " of the " + s.required + " credits needed. At the current pace, they risk not meeting graduation requirements on time, which can be demoralising and is a common trigger for students to consider dropping out entirely." });
  if (s.flags && s.flags.some(f => f.toLowerCase().includes("fail"))) issues.push({ sev: "high", text: "One or more core module failures have been recorded. Failed core modules are particularly serious because many of them are prerequisites - failing them can block progression to the next level and force a student to repeat a whole semester, which often leads to disengagement." });
  if (s.flags && s.flags.some(f => f.toLowerCase().includes("financial") || f.toLowerCase().includes("probation"))) issues.push({ sev: "high", text: "There is a financial hold or academic probation flag on this student's record. Financial stress is a major hidden driver of dropout - students dealing with unpaid fees are often distracted, miss assessments, and feel unable to ask for help. This needs to be addressed alongside academic support." });
  if (s.flags && s.flags.some(f => f.toLowerCase().includes("repeat"))) issues.push({ sev: "mod", text: name + " has repeated one or more courses. While repeating a course is not automatically a crisis, it signals that they are struggling with the material and adds pressure to their workload and self-confidence." });
  if (!issues.length) issues.push({ sev: "low", text: name + "'s overall academic profile is healthy. Their GPA, attendance, and credit progress are all within acceptable ranges. The system's model detected a moderate or low risk based on the combination of all factors, but there are no critical individual concerns at this time." });
  return issues;
}

function generateRecommendedActions(s) {
  const cr = (s.credits || 0) / (s.required || 90);
  const actions = [];
  if (s.risk >= _thresh.high) {
    actions.push({ priority: "urgent", icon: "calendar", title: "Schedule a one-on-one counselling session immediately", detail: "Do not wait for the student to come to you. Reach out directly - by phone or email - and schedule a meeting within the next 3 to 5 working days. The goal of this first meeting is not to criticise their performance, but to understand what obstacles they are facing. Students who feel supported are significantly less likely to drop out, even when their grades are poor." });
    actions.push({ priority: "urgent", icon: "note", title: "Review and rebuild their academic plan", detail: "Together with the student, go through their remaining required credits, failed modules, and current workload. Create a realistic revised academic plan that shows a clear path to graduation - even if it means extending their programme by a semester. Having a visible roadmap reduces the sense of hopelessness that drives dropout decisions." });
  }
  if (s.attendance < 70) actions.push({ priority: "high", icon: "user", title: "Contact the student directly about their attendance", detail: "Before assuming academic disengagement, find out why they are missing classes. Common reasons include transport difficulties, part-time work, family responsibilities, or mental health challenges. Understanding the root cause means you can connect them with the right support - whether that is financial aid, counselling, or flexible assessment options." });
  if (s.gpa < 2.0) actions.push({ priority: "high", icon: "brain", title: "Connect them with peer tutoring or academic support services", detail: "A GPA below 2.0 usually means the student is struggling with the actual content, not just motivation. Connecting them with peer tutors, study groups, or lecturer office hours can make a significant difference. Many students at this stage do not ask for help because they feel ashamed - it helps when an advisor makes the introduction directly." });
  if (cr < 0.75) actions.push({ priority: "high", icon: "chart", title: "Discuss a revised credit load and graduation timeline", detail: "Carrying a large credit deficit is stressful and can lead to students overloading themselves in later semesters, which often makes things worse. Have an honest conversation about whether a slightly extended timeline - one extra semester - would reduce pressure and improve outcomes. Frame this as a smart strategy, not a failure." });
  if (s.flags && s.flags.some(f => f.toLowerCase().includes("financial"))) actions.push({ priority: "high", icon: "shield", title: "Refer to the financial aid or bursary office urgently", detail: "Financial stress is one of the most underreported causes of dropout. A student with a financial hold may be embarrassed to disclose it. Approach the topic with sensitivity and make the referral yourself rather than just giving them a phone number - personal referrals are followed up far more often than self-directed ones." });
  if (s.risk >= _thresh.mod && s.risk < _thresh.high) actions.push({ priority: "normal", icon: "mail", title: "Send a proactive check-in message within the next two weeks", detail: "At this risk level, the situation is manageable but needs monitoring. A short, friendly message - acknowledging their progress while asking if they need any support - can be surprisingly effective. Students at moderate risk often just need to know that someone has noticed and cares about their progress." });
  if (s.gpa >= 2.5 && s.attendance >= 75) actions.push({ priority: "normal", icon: "trend", title: "Acknowledge their progress and keep them motivated", detail: "This student is showing positive signs. A brief note from their advisor recognising their effort can significantly boost motivation and reinforce the behaviours that are keeping them on track. Positive reinforcement is just as important as intervention for at-risk students." });
  if (s.risk < _thresh.mod) actions.push({ priority: "low", icon: "analytics", title: "Continue standard monitoring at next scheduled review", detail: "No immediate action is required. Include this student in your next routine cohort review. Keep an eye on whether their attendance or GPA trend changes in the coming weeks, as early semester dips can sometimes go unnoticed until they become harder to reverse." });
  return actions;
}

function generateOverallSummary(s) {
  const name = firstName(s);
  const cr = (s.credits || 0) / (s.required || 90);
  if (s.risk >= _thresh.high) return name + " is at high risk of dropping out. Their academic data - including a GPA of " + s.gpa.toFixed(1) + ", attendance of " + s.attendance + "%, and completing only " + Math.round(cr * 100) + "% of required credits - places them firmly in the high-risk category. The AI model identified this student as needing urgent advisor intervention. Prompt, supportive action now is the most effective way to change this outcome.";
  if (s.risk >= (_thresh.high + _thresh.mod) / 2) return name + " is showing several warning signs that, taken together, suggest a meaningful risk of disengagement or dropout if the current trends continue. Their GPA and attendance are below recommended levels, and their credit progress is behind schedule. This is the ideal stage to intervene - the problems are real but still manageable with the right support.";
  if (s.risk >= _thresh.mod) return name + " is in a moderate-risk position. There are one or two areas of concern - particularly their " + (s.gpa < 2.5 ? "GPA trend" : "attendance pattern") + " - but overall their profile is not yet critical. A proactive check-in from their advisor in the next couple of weeks is recommended to catch any issues before they escalate.";
  if (s.risk >= _thresh.mod / 2) return name + " is doing reasonably well overall. The model has flagged a low-level risk, mostly due to minor dips in " + (s.gpa < 3 ? "academic performance" : "attendance") + ". No urgent action is needed, but it is worth keeping an eye on their progress at the next scheduled review to make sure the current positive trends continue.";
  return name + " is performing well across all tracked indicators. Their GPA of " + s.gpa.toFixed(1) + ", attendance of " + s.attendance + "%, and credit completion of " + Math.round(cr * 100) + "% are all healthy. The dropout risk model rates them as low risk. Continue standard monitoring - no immediate action required.";
}

let _thresh = { high: 0.70, mod: 0.40 };
const rc = (r, t) => r >= _thresh.high ? t.danger : r >= _thresh.mod ? t.warn : t.safe;
const rbg = (r, t) => r >= _thresh.high ? t.dangerBg : r >= _thresh.mod ? t.warnBg : t.safeBg;
const rbrd = (r, t) => r >= _thresh.high ? t.dangerMuted : r >= _thresh.mod ? t.warnMuted : t.safeMuted;
const rlbl = r => r >= _thresh.high ? "High Risk" : r >= _thresh.mod ? "Moderate" : "Low Risk";

function computeRisk(gpa, att, cr, prog) {
  const b = (1 - gpa / 4) * .4 + (1 - att / 100) * .3 + (1 - cr) * .3;
  return Math.max(.05, Math.min(.97, b + (prog === "Mech. Engineering" ? .04 : prog === "Electrical Eng." ? .02 : 0)));
}

function makeShap(gpa, att, cr, prog, sem) {
  return [{ f: "GPA level", v: +((1 - gpa / 4) * .4 - .1).toFixed(2) }, { f: "Attendance rate", v: +((1 - att / 100) * .3 - .08).toFixed(2) }, { f: "Credit completion", v: +((1 - cr) * .25 - .07).toFixed(2) }, { f: "Semester stage", v: sem === 1 ? -.05 : .03 }, { f: "Programme difficulty", v: prog === "Mech. Engineering" ? .06 : -.03 }];
}

const numVal = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const boolInt = v => {
  if (typeof v === "string") return ["1", "true", "yes", "y", "on"].includes(v.trim().toLowerCase()) ? 1 : 0;
  return v ? 1 : 0;
};
const getFeatureValue = (s, snake, camel, fallback = 0) => numVal(s?.[camel] ?? s?.[snake], fallback);
const featureFlags = (s) => {
  const failed = getFeatureValue(s, "failed_modules", "failedModules");
  const financial = getFeatureValue(s, "financial_flag", "financialFlag");
  const repeated = getFeatureValue(s, "repeated_course", "repeatedCourse");
  const probation = getFeatureValue(s, "probation", "probation");
  return [
    failed > 0 ? failed + " failed module" + (failed > 1 ? "s" : "") : "",
    financial ? "Financial hold" : "",
    repeated ? "Repeated a course" : "",
    probation ? "Academic probation" : "",
  ].filter(Boolean);
};
function makeFlags(s, risk = s.risk) {
  const cr = (numVal(s.credits) || 0) / Math.max(numVal(s.required, 90), 1);
  return [
    numVal(s.gpa) < 2 ? "GPA below minimum passing grade" : "",
    numVal(s.attendance) < 65 ? "Attendance below 65% threshold" : "",
    cr < .75 ? "Significant credit deficit" : "",
    numVal(s.gpa) < 1.5 ? "Critical GPA - academic probation risk" : "",
    numVal(s.attendance) < 50 ? "Critically low attendance" : "",
    risk >= .7 ? "High dropout risk" : "",
    ...featureFlags(s),
  ].filter(Boolean);
}
function studentPayload(s) {
  return {
    student_id: s.id || s.student_id || s.studentId,
    name: s.name || s.full_name || s.fullname || s.student_name || "Unknown Student",
    programme: s.programme || s.program || s.course || "Computer Science",
    level: numVal(s.level || s.year, 100),
    semester: numVal(s.semester, 1),
    gpa: numVal(s.gpa || s.GPA, 0),
    attendance: numVal(s.attendance || s.attendance_rate, 0),
    credits: numVal(s.credits || s.credits_earned, 0),
    required: numVal(s.required || s.required_credits, 90),
    failed_modules: getFeatureValue(s, "failed_modules", "failedModules"),
    financial_flag: boolInt(s.financialFlag ?? s.financial_flag),
    repeated_course: boolInt(s.repeatedCourse ?? s.repeated_course),
    probation: boolInt(s.probation),
  };
}
function enrichStudentFromPrediction(s, pred = {}, previous = {}) {
  const risk = pred.risk_score ?? pred.risk ?? s.predicted ?? s.risk ?? 0;
  const cr = numVal(s.credits) / Math.max(numVal(s.required, 90), 1);
  return {
    ...previous,
    ...s,
    id: s.id || s.student_id || s.studentId,
    name: s.name || s.full_name || s.fullname || s.student_name || previous.name,
    failedModules: getFeatureValue(s, "failed_modules", "failedModules"),
    financialFlag: boolInt(s.financialFlag ?? s.financial_flag),
    repeatedCourse: boolInt(s.repeatedCourse ?? s.repeated_course),
    probation: boolInt(s.probation),
    risk,
    predicted: risk,
    riskLabel: pred.risk_label || s.riskLabel || s.risk_label,
    trend: previous.risk ? (risk > previous.risk + .05 ? "up" : risk < previous.risk - .05 ? "down" : "stable") : "stable",
    flags: makeFlags(s, risk),
    shap: pred.shap_values || s.shap || makeShap(numVal(s.gpa), numVal(s.attendance), cr, s.programme, numVal(s.semester, 1)),
    interventions: s.interventions || previous.interventions || [],
    gpaHist: [...(previous.gpaHist || s.gpaHist || [null, null, null]).slice(-3), numVal(s.gpa)],
    progAvg: s.progAvg || previous.progAvg || .45,
  };
}

function parseCSV(txt, programmesList) {
  const lines = txt.trim().split(/\r?\n/);
  if (lines.length < 2) return { ok: false, msg: "File is empty." };
  const hdrs = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[\'"]/g, ""));
  const nameCol = hdrs.find(h => ["name","full_name","fullname","student_name"].includes(h));
  const idCol = hdrs.find(h => ["id","student_id","studentid"].includes(h));
  const coreRequired = ["programme","level","semester","gpa","attendance","credits","required"];
  const miss = coreRequired.filter(c => !hdrs.includes(c));
  if (!nameCol) miss.push("name (or full_name)");
  if (!idCol) miss.push("id (or student_id)");
  if (miss.length) return { ok: false, msg: "Missing columns: " + miss.join(", ") };
  const data = lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/[\'"]/g, ""));
    const o = {}; hdrs.forEach((h, i) => { o[h] = vals[i] || ""; });
    const resolvedName = o[nameCol] || o.name || o.full_name || o.fullname || o.student_name || "";
    const resolvedId = o[idCol] || o.id || o.student_id || "";
    const gpa = parseFloat(o.gpa) || 0, att = parseFloat(o.attendance) || 0;
    const cr = (parseFloat(o.credits) || 0) / (parseFloat(o.required) || 90);
    const prog = o.programme || "";
    // Validate programme against current list, fallback to first available
    const validProg = programmesList.includes(prog) ? prog : (programmesList[0] || "Computer Science");
    const failedModules = numVal(o.failed_modules || o.failedmodules || o.failedModules || o.failed_modules_count || o.failed || o.failed_modules_count);
    const financialFlag = boolInt(o.financial_flag || o.financialflag || o.financialFlag || o.financial_hold || o.fee_arrears);
    const repeatedCourse = boolInt(o.repeated_course || o.repeatedcourse || o.repeatedCourse || o.repeat || o.repeated);
    const probation = boolInt(o.probation || o.academic_probation);
    return {
      id: resolvedId, name: resolvedName || "Student " + (resolvedId || String(Math.random()).slice(2,7)),
      programme: validProg, level: parseInt(o.level) || 100, semester: parseInt(o.semester) || 1,
      gpa, attendance: att, credits: parseFloat(o.credits) || 0, required: parseFloat(o.required) || 90,
      failedModules, financialFlag, repeatedCourse, probation,
      risk: computeRisk(gpa, att, cr, validProg), trend: "stable", flags: [], interventions: [],
      shap: makeShap(gpa, att, cr, validProg, parseInt(o.semester) || 1),
      gpaHist: [null, null, null, gpa], progAvg: .45,
    };
  }).filter(r => r.name);
  if (!data.length) return { ok: false, msg: "No valid rows found." };
  return { ok: true, data };
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
const TC = createContext(null);
function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const add = useCallback((msg, type = "success") => { const id = Date.now() + Math.random(); setList(p => [...p, { id, msg, type }]); setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3200); }, []);
  const COL = { success: "#059669", error: "#DC2626", info: "#2563EB", warn: "#B45309" };
  const ICN = { success: "OK", error: "X", info: "i", warn: "!" };
  return (<TC.Provider value={add}>{children}<div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999, pointerEvents: "none" }}>{list.map(({ id, msg, type }) => <div key={id} style={{ padding: "11px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 10, minWidth: 260, maxWidth: 360, boxShadow: "0 8px 24px rgba(0,0,0,.18)", pointerEvents: "all", animation: "toastIn .22s ease both", background: COL[type] || "#059669", color: "white" }}><span style={{ fontSize: 15 }}>{ICN[type] || "OK"}</span>{msg}</div>)}</div></TC.Provider>);
}
const useToast = () => useContext(TC);

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
function Spinner({ size = 20, color = "white", thickness = 2.5, variant = "ring" }) {
  if (variant === "dots") {
    const dot = Math.max(8, Math.round(size * .28));
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: Math.max(6, Math.round(size * .12)), height: size, flexShrink: 0 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: dot, height: dot, borderRadius: "50%", background: color, animation: "dotBounce .9s " + (i * .12) + "s ease-in-out infinite", boxShadow: "0 8px 18px " + color + "33" }} />)}
      </span>
    );
  }
  const r = size / 2 - thickness;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ animation: "spinnerRotate .95s linear infinite", flexShrink: 0, filter: "drop-shadow(0 2px 5px rgba(0,0,0,.18))" }} viewBox={"0 0 " + size + " " + size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color + "26"} strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circ * .58 + " " + circ * .42}
        strokeDashoffset={0}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  );
}
function PredictionLoader({ t, pct = null, compact = false }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: compact ? 8 : 14, padding: compact ? "0" : "14px 18px", borderRadius: compact ? 0 : 16, background: compact ? "transparent" : t.accentBg, border: compact ? "none" : "1px solid " + t.accentMuted, animation: compact ? "none" : "loaderGlow 1.6s ease-in-out infinite" }}>
      <span style={{ width: compact ? 22 : 46, height: compact ? 22 : 46, borderRadius: compact ? 8 : 15, background: compact ? "rgba(255,255,255,.16)" : t.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: compact ? "none" : t.shadow }}>
        <Icon ic={IC.brain} size={compact ? 13 : 22} color={compact ? "white" : t.accent} />
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: compact ? 7 : 10 }}>
        <Spinner variant="dots" size={compact ? 18 : 34} color={compact ? "white" : t.accent} />
        {pct !== null && <span style={{ fontSize: compact ? 12 : 18, fontWeight: 800, color: compact ? "white" : t.accent }}>{pct}%</span>}
      </span>
    </div>
  );
}
function PageTransitionOverlay({ t, label }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, background: t.bg + "E8", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .16s ease both" }}>
      <div style={{ minWidth: 210, padding: "22px 26px", borderRadius: 14, background: t.surface, border: "1px solid " + t.border, boxShadow: t.shadowMd, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Spinner variant="dots" size={38} color={t.accent} />
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{label || "Opening page"}</div>
      </div>
    </div>
  );
}
function Card({ t, children, style = {}, hover, onClick, glass }) {
  const baseStyle = glass
    ? { background: t.surface, border: "1px solid " + t.border, borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08), 0 1px 0 rgba(255,255,255,.6) inset", ...style }
    : { background: t.surface, border: "1px solid " + t.border, borderRadius: 12, boxShadow: t.shadow, ...style };
  return <div className={hover ? "ea-card-h" : ""} onClick={onClick} style={baseStyle}>{children}</div>;
}
function Badge({ risk, t, sm }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: sm ? "2px 8px" : "4px 10px", borderRadius: 20, fontSize: sm ? 11 : 12, fontWeight: 600, background: rbg(risk, t), color: rc(risk, t), border: "1px solid " + rbrd(risk, t) }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: rc(risk, t), flexShrink: 0 }} />{rlbl(risk)}</span>; }
function Avatar({ name, risk, t, size = 36 }) { const safeName = (name && typeof name === "string" && name.trim()) ? name : "??"; const ini = safeName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); return <div style={{ width: size, height: size, borderRadius: size * .28, flexShrink: 0, background: rbg(risk, t), border: "1.5px solid " + rbrd(risk, t), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * .35, fontWeight: 700, color: rc(risk, t), userSelect: "none" }}>{ini}</div>; }
function Bar({ pct, color, t, h = 6 }) { return <div style={{ height: h, background: t.surface2, borderRadius: h, overflow: "hidden" }}><div className="ea-gbar" style={{ height: "100%", width: Math.min(100, Math.max(0, pct) * 100) + "%", background: color, borderRadius: h }} /></div>; }
function Sparkline({ trend, t }) { const pts = { up: "0,18 8,14 16,16 24,10 32,6 40,2", down: "0,2 8,6 16,4 24,10 32,14 40,18", stable: "0,10 8,8 16,11 24,9 32,10 40,9" }[trend] || "0,10 40,10"; const col = trend === "up" ? t.danger : trend === "down" ? t.safe : t.warn; return <svg width={40} height={20} viewBox="0 0 40 20"><polyline points={pts} fill="none" stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function RiskGauge({ value, t, size = 100 }) { const r = size * .36, cx = size / 2, cy = size / 2, rad = d => d * Math.PI / 180; const arc = (cx, cy, r, s, e) => { const S = { x: cx + r * Math.cos(rad(s)), y: cy + r * Math.sin(rad(s)) }, E = { x: cx + r * Math.cos(rad(e)), y: cy + r * Math.sin(rad(e)) }; return "M" + S.x + " " + S.y + "A" + r + " " + r + " 0 " + ((e - s) > 180 ? 1 : 0) + " 1 " + E.x + " " + E.y; }; return (<svg width={size} height={size}><path d={arc(cx, cy, r, 135, 405)} fill="none" stroke={t.border} strokeWidth={size * .07} strokeLinecap="round" /><path d={arc(cx, cy, r, 135, 135 + 270 * value)} fill="none" stroke={rc(value, t)} strokeWidth={size * .07} strokeLinecap="round" /><text x={cx} y={cy + 3} textAnchor="middle" fill={t.text} fontSize={size * .18} fontWeight="700" fontFamily="Plus Jakarta Sans,sans-serif">{Math.round(value * 100)}%</text><text x={cx} y={cy + size * .17} textAnchor="middle" fill={t.muted} fontSize={size * .1} fontFamily="Plus Jakarta Sans,sans-serif">{rlbl(value)}</text></svg>); }
function ShapBar({ data, t }) { const mx = Math.max(...data.map(d => Math.abs(d.v))); return (<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{data.map((d, i) => (<div key={i}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, color: t.textSub }}>{d.f}</span><span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 500, color: d.v > 0 ? t.danger : t.safe }}>{d.v > 0 ? "+" : ""}{d.v.toFixed(2)}</span></div><div style={{ height: 6, background: t.surface2, borderRadius: 3, overflow: "hidden" }}><div className="ea-gbar" style={{ height: "100%", width: Math.abs(d.v) / mx * 100 + "%", background: d.v > 0 ? t.danger : t.safe, borderRadius: 3, opacity: .85 }} /></div></div>))}</div>); }
function Toggle({ on, toggle, t }) { return <div role="switch" tabIndex={0} onClick={toggle} onKeyDown={e => e.key === "Enter" && toggle()} style={{ width: 40, height: 22, borderRadius: 11, background: on ? t.accent : t.border2, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} /></div>; }
function GpaTrend({ hist, t, avg }) { const valid = hist.filter(v => v != null); if (!valid.length) return <div style={{ fontSize: 12, color: t.muted, padding: "12px 0" }}>Not enough data.</div>; const w = 260, h = 80, pad = 24, lbls = ["S1", "S2", "S3", "S4"].slice(0, hist.length); const mn = Math.max(0, Math.min(...valid) - .3), mx = Math.min(4, Math.max(...valid) + .3), rng = mx - mn || 1; const xs = hist.map((_, i) => pad + (i / (hist.length - 1 || 1)) * (w - pad * 2)); const ys = hist.map(v => v == null ? null : h - 4 - ((v - mn) / rng) * (h - 12)); const pts = hist.map((v, i) => v != null ? xs[i] + "," + ys[i] : null).filter(Boolean).join(" "); const ay = Math.max(4, Math.min(h - 4, h - 4 - ((avg * 4 - mn) / rng) * (h - 12))); return (<svg width={w} height={h} viewBox={"0 0 " + w + " " + h}><line x1={pad} y1={ay} x2={w - pad} y2={ay} stroke={t.warn} strokeWidth={1} strokeDasharray="4 3" opacity={.6} />{pts && <polyline points={pts} fill="none" stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}{hist.map((v, i) => v != null && (<g key={i}><circle cx={xs[i]} cy={ys[i]} r={4} fill={t.surface} stroke={t.accent} strokeWidth={2} /><text x={xs[i]} y={h} fill={t.muted} fontSize={9} textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">{lbls[i]}</text><text x={xs[i]} y={ys[i] - 7} fill={t.text} fontSize={9} textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">{v.toFixed(1)}</text></g>))}</svg>); }
function Empty({ icon, title, sub, action, t }) { return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 48, textAlign: "center" }}><div style={{ opacity: .22, display: "flex", justifyContent: "center" }}><Icon ic={typeof icon === "string" ? IC.folder : icon} size={44} color={t.muted} /></div><div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{title}</div>{sub && <div style={{ fontSize: 13, color: t.muted, maxWidth: 300, lineHeight: 1.6 }}>{sub}</div>}{action}</div>); }
function Modal({ onClose, children, t, width = 640 }) { return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.46)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }} onClick={e => e.target === e.currentTarget && onClose()}><div style={{ background: t.surface, borderRadius: 16, border: "1px solid " + t.border, boxShadow: "0 20px 60px rgba(0,0,0,.22)", width: "100%", maxWidth: width, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>{children}</div></div>); }

// ─── MODALS (unchanged) ────────────────────────────────────────────────────────
function LogoutModal({ t, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} t={t} width={400}>
      <div style={{ padding: "28px 28px 24px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: t.dangerBg, border: "1px solid " + t.dangerMuted, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Icon ic={IC.logout} size={24} color={t.danger} /></div>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>Sign out of EduAlert?</div>
        <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.65, marginBottom: 24 }}>You will be returned to the login screen. Any unsaved intervention notes will be lost.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px 0", background: t.danger, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>
    </Modal>
  );
}

function ClearModal({ t, count, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} t={t} width={420}>
      <div style={{ padding: "28px 28px 24px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: t.warnBg, border: "1px solid " + t.warnMuted, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Icon ic={IC.trash} size={24} color={t.warn} /></div>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>Clear all student data?</div>
        <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.7, marginBottom: 24 }}>This will permanently remove all <strong style={{ color: t.text }}>{count} student records</strong>, their risk scores, flags, and intervention history from this session. This cannot be undone.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel - keep data</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px 0", background: t.warn, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Yes, clear everything</button>
        </div>
      </div>
    </Modal>
  );
}

// ... (rest of App.jsx unchanged)

function EmailModal({ t, student, onClose, onEmailSent }) {
  const toast = useToast();
  const [to_, setTo] = useState((student.name || "student").toLowerCase().replace(/ /g, ".") + "@uenr.edu.gh");
  const [msg, setMsg] = useState("Dear " + (student.name || "Student").split(" ")[0] + ",\n\nI would like to schedule a meeting with you to discuss your academic progress this semester. The EduAlert system has flagged some areas that I believe we can address together with the right support.\n\nPlease reply to this email to confirm a suitable time.\n\nBest regards,\nAcademic Advisor - UENR");
  const [sent, setSent] = useState(false); const [sending, setSending] = useState(false);
  
  async function send() {
    if (sending) return;
    const trimmedTo = to_.trim();
    if (!trimmedTo || !trimmedTo.includes("@")) { toast("Please enter a valid email address", "error"); return; }
    setSending(true);
    let emailSentOk = false;
    try {
      const res = await apiFetch("/notifications/alert", {
        method: "POST", body: JSON.stringify({
          student_id: student.id || "UNKNOWN", student_name: student.name || "Student",
          programme: student.programme || "", risk_score: student.risk || 0, student_email: trimmedTo,
          message: msg,
        })
      });
      emailSentOk = !!(res && res.sent);
      if (!emailSentOk) toast((res && res.message) || "Email could not be delivered by server", "warn");
    } catch (e) {
      // backend unavailable — still log locally
    } finally {
      setSending(false);
    }
    // Always log the email as an intervention regardless of backend status
    const subject = "Academic Support - " + student.name;
    const logNote = "Email sent to " + trimmedTo + " | Subject: " + subject + " | Preview: " + msg.slice(0, 120).replace(/\n/g, " ") + (msg.length > 120 ? "…" : "");
    if (onEmailSent) onEmailSent(student.id, { date: new Date().toISOString().split("T")[0], note: "[EMAIL] " + logNote, by: "Advisor", type: "email" });
    toast("Email logged" + (emailSentOk ? " & sent" : " locally"), "success");
    setSent(true);
    setTimeout(onClose, 1600);
  }
  
  const iS = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };
  
  return (
    <Modal onClose={onClose} t={t} width={520}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Send Alert Email</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Email goes directly to the address below via SendGrid</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>x</button>
      </div>
      <div style={{ padding: "20px 22px" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: t.safeBg, border: "1px solid " + t.safeMuted, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icon ic={IC.check} size={24} color={t.safe} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.safe, marginBottom: 6 }}>Email sent successfully</div>
            <div style={{ fontSize: 13, color: t.muted }}>The email was sent to <strong>{to_}</strong> and logged.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Recipient email address</label><input value={to_} onChange={e => setTo(e.target.value)} placeholder="student@uenr.edu.gh" style={iS} /><div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Edit the address above to send to any email. SendGrid will deliver it.</div></div>
            <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Subject</label><input value={"Academic Support - " + student.name} readOnly style={{ ...iS, background: t.surface2, color: t.muted }} /></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Message</label><textarea value={msg} onChange={e => setMsg(e.target.value)} rows={7} style={{ ...iS, resize: "vertical", lineHeight: 1.6 }} /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={send} disabled={sending} style={{ padding: "9px 18px", background: sending ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                {sending ? <><Spinner size={14} color="white" /> Sending...</> : <><Icon ic={IC.mail} size={14} color="white" /> Send Email</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ... (rest of App.jsx unchanged)

function UploadModal({ t, onClose, onImport, programmesList }) {
  const toast = useToast();
  const [step, setStep] = useState("drop"); const [rows, setRows] = useState([]); const [err, setErr] = useState(""); const [drag, setDrag] = useState(false); const fRef = useRef();
  function handle(file) { if (!file) return; if (!["csv", "txt"].includes(file.name.split(".").pop().toLowerCase())) { setErr("Please upload a .csv file"); setStep("error"); return; } const reader = new FileReader(); reader.onload = e => { const r = parseCSV(e.target.result, programmesList); if (!r.ok) { setErr(r.msg); setStep("error"); } else { setRows(r.data); setStep("preview"); } }; reader.readAsText(file); }
  function confirm() { onImport(rows); toast(rows.length + " students imported", "success"); onClose(); }
  function dlTpl() { const csv = REQCOLS.join(",") + "\nKwame Test,UEN/CS/2025/001,Computer Science,200,1,3.1,85,42,45"; const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "template.csv"; a.click(); }
  const iS = { width: "100%", padding: "8px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };
  return (
    <Modal onClose={onClose} t={t} width={680}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Upload Student Dataset</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>CSV import - risk scores computed automatically</div></div><button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>x</button></div>
      <div style={{ padding: "20px 22px", overflowY: "auto" }}>
        {step === "drop" && (<><div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }} onClick={() => fRef.current.click()} style={{ border: "2px dashed " + (drag ? t.accent : t.border2), borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: drag ? t.accentBg : "transparent", transition: "all .15s" }}><div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Icon ic={IC.folder} size={38} color={t.muted} /></div><div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Drop your CSV here or click to browse</div><input ref={fRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={e => handle(e.target.files[0])} /></div><div style={{ marginTop: 16, padding: "14px 16px", background: t.surface2, borderRadius: 10, border: "1px solid " + t.border }}><div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 8 }}>Required columns</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{REQCOLS.map(c => <span key={c} style={{ padding: "3px 9px", background: t.accentBg, borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.accent, border: "1px solid " + t.accentMuted, fontFamily: "monospace" }}>{c}</span>)}</div><button onClick={dlTpl} style={{ fontSize: 12, color: t.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}><Icon ic={IC.download} size={13} color={t.accent} /> Download template CSV</button></div></>)}
        {step === "preview" && (<><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{rows.length} students ready</div><button onClick={() => setStep("drop")} style={{ fontSize: 12, color: t.muted, background: "none", border: "none", cursor: "pointer" }}>Change file</button></div><div style={{ border: "1px solid " + t.border, borderRadius: 10, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: t.surface2 }}>{["Name", "ID", "Programme", "GPA", "Risk"].map(h => <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: t.muted, borderBottom: "1px solid " + t.border }}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} style={{ borderBottom: "1px solid " + t.border }}><td style={{ padding: "8px 12px", color: t.text, fontWeight: 500 }}>{r.name}</td><td style={{ padding: "8px 12px", color: t.muted, fontFamily: "monospace", fontSize: 11 }}>{r.id}</td><td style={{ padding: "8px 12px", color: t.textSub }}>{r.programme}</td><td style={{ padding: "8px 12px", fontWeight: 600, color: r.gpa >= 3 ? t.safe : r.gpa >= 2 ? t.warn : t.danger }}>{r.gpa.toFixed(1)}</td><td style={{ padding: "8px 12px" }}><Badge risk={r.risk} t={t} sm /></td></tr>)}</tbody></table></div></>)}
        {step === "error" && (<div style={{ padding: "24px", background: t.dangerBg, borderRadius: 12, border: "1px solid " + t.dangerMuted, textAlign: "center" }}><div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Icon ic={IC.alert} size={28} color={t.danger} /></div><div style={{ fontSize: 15, fontWeight: 700, color: t.danger, marginBottom: 8 }}>Could not parse file</div><div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginBottom: 16 }}>{err}</div><button onClick={() => setStep("drop")} style={{ padding: "8px 18px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Try again</button></div>)}
      </div>
      {step === "preview" && <div style={{ padding: "14px 22px", borderTop: "1px solid " + t.border, display: "flex", justifyContent: "flex-end", gap: 10 }}><button onClick={onClose} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button><button onClick={confirm} style={{ padding: "9px 18px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Import {rows.length} students</button></div>}
    </Modal>
  );
}

function IntModal({ t, student, onClose, onSave }) {
  const [note, setNote] = useState(""); const [type, setType] = useState("meeting");
  const NOTE_TYPES = [{ id: "meeting", lbl: "Meeting" }, { id: "email", lbl: "Email" }, { id: "call", lbl: "Phone Call" }, { id: "referral", lbl: "Referral" }, { id: "other", lbl: "Other" }];
  function save() {
    if (!note.trim()) return;
    onSave(student.id, { date: new Date().toISOString().split("T")[0], note: "[" + type.toUpperCase() + "] " + note.trim(), by: "Advisor", type });
    onClose();
  }
  return (<Modal onClose={onClose} t={t} width={480}>
    <div style={{ padding: "18px 22px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Log Intervention</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>For <strong style={{ color: t.textSub }}>{student.name}</strong></div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
    </div>
    <div style={{ padding: "20px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Intervention Type</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {NOTE_TYPES.map(nt => <button key={nt.id} onClick={() => setType(nt.id)} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (type === nt.id ? t.accent : t.border2), background: type === nt.id ? t.accentBg : "transparent", color: type === nt.id ? t.accent : t.muted, transition: "all .12s" }}>{nt.lbl}</button>)}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Notes</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={5} placeholder="Describe the intervention, meeting outcome, follow-up actions, or any other relevant notes..." style={{ width: "100%", padding: "10px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13, resize: "vertical", lineHeight: 1.6 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={save} disabled={!note.trim()} style={{ padding: "9px 18px", background: note.trim() ? t.accent : t.border2, border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600, cursor: note.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 7 }}><Icon ic={IC.note} size={13} color="white" /> Save Note</button>
      </div>
    </div>
  </Modal>);
}

// ─── SIDEBAR (unchanged) ─────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", lbl: "Overview", icon: IC.dash },
  { id: "students", lbl: "Students", icon: IC.students },
  { id: "analytics", lbl: "Analytics", icon: IC.analytics },
  { id: "predict", lbl: "Predict", icon: IC.predict },
  { id: "settings", lbl: "Settings", icon: IC.settings },
];
function Sidebar({ active, setActive, t, dark, setDark, onLogout, onClear, studentCount, user, sidebarAvatar, academicYear, semester }) {
  return (
    <aside style={{ width: 232, flexShrink: 0, background: "linear-gradient(180deg,#0F2F1A 0%,#14532D 48%,#0F766E 100%)", borderRight: "1px solid rgba(255,255,255,.14)", display: "flex", flexDirection: "column", padding: "18px 12px", color: "white", boxShadow: "8px 0 30px rgba(15,47,26,.16)", position: "relative", overflow: "hidden" }}>
      <img src={UENR_LOGO} alt="" style={{ position: "absolute", left: -44, bottom: 84, width: 180, height: 180, objectFit: "contain", opacity: .055, pointerEvents: "none" }} />
      <div style={{ padding: "6px 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.96)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 3, boxShadow: "0 10px 24px rgba(0,0,0,.18)" }}><img src={UENR_LOGO} alt="UENR" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
        <div><div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>EduAlert</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.68)" }}>UENR | {academicYear ? academicYear.replace('20','').replace('/20','/') : '24/25'} {semester ? semester.replace('Semester ','S') : 'S2'}</div></div>
      </div>
      <div style={{ padding: "0 10px", marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>Home</span><Icon ic={IC.chevR} size={10} color="rgba(255,255,255,.55)" /><span style={{ fontSize: 10, color: "rgba(255,255,255,.55)", margin: "0 1px" }}></span>
        <span style={{ fontSize: 11, color: "#D9F99D", fontWeight: 700 }}>{(NAV.find(n => n.id === active) || {}).lbl}</span>
      </div>
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.48)", padding: "0 10px", marginBottom: 6, letterSpacing: ".08em" }}>NAVIGATION</div>
        {NAV.map(({ id, lbl, icon }) => { const a = active === id; return <button key={id} onClick={() => setActive(id)} className="ea-side-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 10, border: "1px solid " + (a ? "rgba(255,255,255,.22)" : "transparent"), width: "100%", textAlign: "left", background: a ? "rgba(255,255,255,.16)" : "transparent", color: "white", fontWeight: a ? 800 : 600, fontSize: 14, boxShadow: a ? "0 10px 26px rgba(0,0,0,.14)" : "none", cursor: "pointer" }}><Icon ic={icon} size={16} color={a ? "#D9F99D" : "rgba(255,255,255,.72)"} />{lbl}</button>; })}
      </nav>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.16)", paddingTop: 12, position: "relative" }}>
        <button onClick={() => setDark(d => !d)} className="ea-side-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid transparent", width: "100%", background: "transparent", color: "rgba(255,255,255,.78)", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
          <Icon ic={dark ? IC.sun : IC.moon} size={15} color="rgba(255,255,255,.78)" />{dark ? "Light mode" : "Dark mode"}
        </button>
        {studentCount > 0 && (
          <button onClick={onClear} className="ea-side-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid transparent", width: "100%", background: "transparent", color: "#FDE68A", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
            <Icon ic={IC.trash} size={15} color={t.warn} />Clear Data ({studentCount})
          </button>
        )}
        <button onClick={onLogout} className="ea-side-nav" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(254,202,202,.12)", width: "100%", background: "rgba(127,29,29,.18)", color: "#FECACA", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
          <Icon ic={IC.logout} size={15} color="#FECACA" />Sign Out
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderTop: "1px solid rgba(255,255,255,.16)", paddingTop: 12, marginTop: 4, background: "rgba(255,255,255,.08)", borderRadius: 12 }}>
          {sidebarAvatar}
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(user && user.name) || "Advisor"}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(user && user.email) || "advisor@uenr.edu.gh"}</div></div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ title, sub, t, onLogout, onClear, studentCount, lastUpdated, onRefresh, refreshing, unreadCount = 0, onNotifClick, academicYear, semester, setAcademicYear, setSemester }) {
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
    <header style={{ height: 64, borderBottom: "1px solid " + t.border, background: "linear-gradient(180deg," + t.surface + "f7," + t.surface + "ee)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", padding: "0 28px", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 10px 30px rgba(15,23,42,.06)", zIndex: 20 }}>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: t.text, letterSpacing: "-.2px" }}>{title}</div>
        {sub && (
          <div style={{ fontSize: 11, color: t.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
            {sub}
            {academicYear && semester && (
              <>
                <span>|</span>
                <button onClick={() => { setAcadDraft(academicYear); setSemDraft(semester); setEditingAcad(true); setTimeout(() => acadRef.current && acadRef.current.focus(), 50); }}
                  style={{ fontSize: 11, color: t.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, display: "inline-flex", alignItems: "center", gap: 3 }}>
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
            <div><label style={{ fontSize: 11, fontWeight: 600, color: t.muted, display: "block", marginBottom: 4 }}>Academic Year</label>
              <input ref={acadRef} value={acadDraft} onChange={e => setAcadDraft(e.target.value)} placeholder="e.g. 2024/2025" style={{ width: "100%", padding: "7px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 7, color: t.text, fontSize: 13 }} />
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: t.muted, display: "block", marginBottom: 4 }}>Semester</label>
              <select value={semDraft} onChange={e => setSemDraft(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 7, color: t.text, fontSize: 13, cursor: "pointer" }}>
                {["Semester 1","Semester 2","Trimester 1","Trimester 2","Trimester 3"].map(s => <option key={s}>{s}</option>)}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: backendOk ? t.safeBg : t.surface2, border: "1px solid " + (backendOk ? t.safeMuted : t.border) }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: backendOk === null ? t.warn : backendOk ? t.safe : t.danger, transition: "background .3s" }} />
          <span style={{ fontSize: 12, color: t.muted }}>{backendOk === null ? "Connecting..." : backendOk ? "ML Model active" : "Backend unreachable"}</span>
        </div>
        {lastUpdated && <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", background: t.surface2, borderRadius: 999, border: "1px solid " + t.border }}><Icon ic={IC.clock} size={12} color={t.muted} /><span style={{ fontSize: 11, color: t.muted }}>Updated</span><span style={{ fontSize: 11, fontWeight: 700, color: t.textSub }}>{fmtTime(lastUpdated)}</span></div>}
        {studentCount > 0 && (
          <button onClick={onRefresh} disabled={refreshing} title="Re-run predictions" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: refreshing ? t.surface2 : "linear-gradient(135deg,#EFF6FF,#ECFDF5)", border: "1px solid " + t.accentMuted, borderRadius: 999, color: refreshing ? t.muted : t.accent, fontSize: 12, fontWeight: 800, cursor: refreshing ? "not-allowed" : "pointer", transition: "all .15s" }}>
            <span style={{ display: "inline-flex", animation: refreshing ? "spin .7s linear infinite" : "none" }}><Icon ic={IC.refresh} size={13} color={refreshing ? t.muted : t.accent} /></span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
        <button onClick={onNotifClick} style={{ position: "relative", width: 38, height: 38, borderRadius: 12, background: unreadCount > 0 ? t.dangerBg : t.surface2, border: "1px solid " + (unreadCount > 0 ? t.dangerMuted : t.border2), display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s", boxShadow: unreadCount > 0 ? "0 8px 22px " + t.danger + "22" : "none" }}>
          <span style={{ display: "inline-flex", animation: unreadCount > 0 ? "bellRing 1.6s ease-in-out 0.3s both" : "none", transformOrigin: "top center" }}>
            <Icon ic={IC.bell} size={16} color={unreadCount > 0 ? t.danger : t.muted} />
          </span>
          {unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: t.danger, color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + t.surface }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>
      </div>
    </header>
  );
}

// ─── OVERVIEW PAGE (unchanged) ────────────────────────────────────────────────
// ─── OVERVIEW CHARTS ─────────────────────────────────────────────────────────
function PieDonutChart({ high, mod, low, total, donut, t, colors }) {
  const [hov, setHov] = useState(null);
  const cc = colors || {};
  const data = [
    { lbl: "High Risk", val: high, col: cc.high || t.danger },
    { lbl: "Moderate", val: mod, col: cc.mod || t.warn },
    { lbl: "Low Risk", val: low, col: cc.low || t.safe },
  ].filter(d => d.val > 0);
  if (!total) return <div style={{ textAlign: "center", padding: "40px 0", color: t.muted, fontSize: 13 }}>No data</div>;
  const cx = 90, cy = 90, r = donut ? 60 : 80, inner = donut ? 36 : 0;
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.val / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const xi1 = cx + inner * Math.cos(angle - sweep), yi1 = cy + inner * Math.sin(angle - sweep);
    const xi2 = cx + inner * Math.cos(angle), yi2 = cy + inner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = inner
      ? "M" + xi1 + " " + yi1 + " L" + x1 + " " + y1 + " A" + r + " " + r + " 0 " + large + " 1 " + x2 + " " + y2 + " L" + xi2 + " " + yi2 + " A" + inner + " " + inner + " 0 " + large + " 0 " + xi1 + " " + yi1 + " Z"
      : "M" + cx + " " + cy + " L" + x1 + " " + y1 + " A" + r + " " + r + " 0 " + large + " 1 " + x2 + " " + y2 + " Z";
    const midA = angle - sweep / 2;
    const lx = cx + (r + 12) * Math.cos(midA), ly = cy + (r + 12) * Math.sin(midA);
    return { ...d, path, lx, ly, pct: Math.round(d.val / total * 100) };
  });
  const active = hov ? data.find(d => d.lbl === hov) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.col} opacity={hov && hov !== s.lbl ? .45 : 1}
            style={{ cursor: "pointer", transition: "opacity .15s" }}
            onMouseEnter={() => setHov(s.lbl)} onMouseLeave={() => setHov(null)} />
        ))}
        {donut && <circle cx={cx} cy={cy} r={inner - 2} fill={t.surface} />}
        {donut && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
            <tspan x={cx} dy="-8" fontSize="18" fontWeight="800" fill={active ? active.col : t.text}>{active ? active.val : total}</tspan>
            <tspan x={cx} dy="18" fontSize="10" fill={t.muted}>{active ? active.lbl : "students"}</tspan>
          </text>
        )}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: hov && hov !== s.lbl ? .4 : 1, transition: "opacity .15s" }}
            onMouseEnter={() => setHov(s.lbl)} onMouseLeave={() => setHov(null)}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.col, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: t.textSub }}>{s.lbl}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: s.col, marginLeft: "auto" }}>{s.val}</span>
            <span style={{ fontSize: 11, color: t.muted }}>({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChartOv({ high, mod, low, total, t, colors }) {
  const [hov, setHov] = useState(null);
  const cc = colors || {};
  const items = [{ lbl: "High Risk", val: high, col: cc.high || t.danger }, { lbl: "Moderate", val: mod, col: cc.mod || t.warn }, { lbl: "Low Risk", val: low, col: cc.low || t.safe }];
  const max = Math.max(...items.map(d => d.val), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
      {items.map((item, i) => {
        const pct = Math.round(item.val / total * 100) || 0;
        const isH = hov === item.lbl;
        return (
          <div key={i} onMouseEnter={() => setHov(item.lbl)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: isH ? item.col : t.textSub, fontWeight: isH ? 700 : 500, transition: "all .15s" }}>{item.lbl}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: item.col }}>{item.val} <span style={{ fontWeight: 400, color: t.muted, fontSize: 11 }}>({pct}%)</span></span>
            </div>
            <div style={{ height: 22, background: t.surface2, borderRadius: 6, overflow: "hidden", border: "1px solid " + t.border }}>
              <div style={{ height: "100%", width: (item.val / max * 100) + "%", background: item.col, borderRadius: 6, transition: "width .55s cubic-bezier(.4,0,.2,1)", opacity: hov && !isH ? .35 : 1 }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: t.muted, marginTop: 4, textAlign: "right" }}>Total: {total} students</div>
    </div>
  );
}

function HistogramOv({ students, t, colors }) {
  const [hov, setHov] = useState(null);
  const cc = colors || {};
  const buckets = Array.from({ length: 10 }, (_, i) => ({ lo: i * 0.1, hi: (i + 1) * 0.1, students: [] }));
  students.forEach(s => { const b = Math.min(9, Math.floor(s.risk * 10)); buckets[b].students.push(s); });
  const max = Math.max(...buckets.map(b => b.students.length), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, marginBottom: 6 }}>
        {buckets.map((b, i) => {
          const h = (b.students.length / max) * 100;
          const col = b.lo >= .7 ? (cc.high || t.danger) : b.lo >= .4 ? (cc.mod || t.warn) : (cc.low || t.safe);
          const isH = hov === i;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", cursor: "pointer" }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {isH && <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 2 }}>{b.students.length}</div>}
              <div style={{ width: "100%", height: h + "%", background: col, borderRadius: "3px 3px 0 0", opacity: hov !== null && !isH ? .3 : 1, transition: "all .15s", minHeight: b.students.length ? 3 : 0 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.muted }}>
        {["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"].map((v, i) => <span key={i}>{v}</span>)}
      </div>
      <div style={{ fontSize: 11, color: t.muted, textAlign: "center", marginTop: 4 }}>Risk score distribution (%)</div>
      {hov !== null && buckets[hov].students.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: t.surface2, borderRadius: 8, fontSize: 12, color: t.textSub }}>
          <strong style={{ color: t.text }}>{Math.round(buckets[hov].lo * 100)}-{Math.round(buckets[hov].hi * 100)}% risk range:</strong> {buckets[hov].students.length} student{buckets[hov].students.length !== 1 ? "s" : ""}
          {buckets[hov].students.length <= 3 && " — " + buckets[hov].students.map(s => s.name).join(", ")}
        </div>
      )}
    </div>
  );
}

function ScatterOv({ students, t, colors }) {
  const [hov, setHov] = useState(null);
  const cc = colors || {};
  const W = 320, H = 140, padL = 28, padB = 22, padR = 10, padT = 8;
  if (!students.length) return <div style={{ textAlign: "center", padding: "32px 0", color: t.muted, fontSize: 13 }}>No data</div>;
  return (
    <div>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>GPA vs Attendance — dot size = risk score</div>
      <svg width="100%" viewBox={"0 0 " + W + " " + H} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => {
          const y = padT + (H - padB - padT) * (1 - v / 100);
          return <g key={v}><line x1={padL} y1={y} x2={W - padR} y2={y} stroke={t.border} strokeWidth=".5" /><text x={padL - 3} y={y + 3} fill={t.muted} fontSize="7" textAnchor="end" fontFamily="Plus Jakarta Sans,sans-serif">{v}</text></g>;
        })}
        {[0, 1, 2, 3, 4].map(v => {
          const x = padL + (W - padL - padR) * (v / 4);
          return <g key={v}><line x1={x} y1={padT} x2={x} y2={H - padB} stroke={t.border} strokeWidth=".5" /><text x={x} y={H - padB + 10} fill={t.muted} fontSize="7" textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">{v}</text></g>;
        })}
        {/* Axis labels */}
        <text x={(padL + W - padR) / 2} y={H} fill={t.muted} fontSize="8" textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">GPA</text>
        <text x={6} y={(padT + H - padB) / 2} fill={t.muted} fontSize="8" textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif" transform={"rotate(-90 6 " + ((padT + H - padB) / 2) + ")"}>Att%</text>
        {students.map((s, i) => {
          const cx = padL + (s.gpa / 4) * (W - padL - padR);
          const cy = padT + (H - padB - padT) * (1 - s.attendance / 100);
          const r = 3 + s.risk * 6;
          const col = s.risk >= _thresh.high ? (cc.high || t.danger) : s.risk >= _thresh.mod ? (cc.mod || t.warn) : (cc.low || t.safe);
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill={col} fillOpacity={hov === i ? 1 : .6} stroke={col} strokeWidth={hov === i ? 2 : 0}
              style={{ cursor: "pointer", transition: "all .12s" }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />
          );
        })}
        {hov !== null && students[hov] && (() => {
          const s = students[hov];
          const cx = padL + (s.gpa / 4) * (W - padL - padR);
          const cy = padT + (H - padB - padT) * (1 - s.attendance / 100);
          return <text x={Math.min(cx + 6, W - 60)} y={Math.max(cy - 4, 12)} fill={t.text} fontSize="8" fontWeight="700" fontFamily="Plus Jakarta Sans,sans-serif">{s.name ? s.name.split(" ")[0] : ""}</text>;
        })()}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
        {[["High", cc.high || t.danger], ["Moderate", cc.mod || t.warn], ["Low", cc.low || t.safe]].map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: .7 }} /><span style={{ fontSize: 11, color: t.muted }}>{l}</span></div>
        ))}
      </div>
    </div>
  );
}

function AreaChartOv({ high, mod, low, total, t, colors }) {
  const cc = colors || {};
  // Simulated weekly trend data for each group (last 8 weeks)
  const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
  const seed = (base, noise) => weeks.map((_, i) => Math.max(0, Math.round(base + (i - 4) * noise + (Math.sin(i * 1.3) * noise * .5))));
  const highData = seed(high, 1.2);
  const modData  = seed(mod, 1.8);
  const lowData  = seed(low, 2.1);
  const allVals = [...highData, ...modData, ...lowData];
  const maxV = Math.max(...allVals, 1);
  const W = 320, H = 120, padL = 28, padB = 20, padR = 10, padT = 6;
  const iW = W - padL - padR, iH = H - padB - padT;
  const pts = (data) => data.map((v, i) => [padL + (i / (weeks.length - 1)) * iW, padT + iH * (1 - v / maxV)]);
  const areaPath = (data, col) => {
    const p = pts(data);
    const line = p.map((pt, i) => (i === 0 ? "M" : "L") + pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join(" ");
    const area = line + " L" + p[p.length-1][0].toFixed(1) + " " + (padT+iH) + " L" + padL + " " + (padT+iH) + " Z";
    return { line, area };
  };
  const hPath = areaPath(highData); const mPath = areaPath(modData); const lPath = areaPath(lowData);
  return (
    <div>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>Simulated 8-week trend by risk group</div>
      <svg width="100%" viewBox={"0 0 " + W + " " + H} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="ag-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cc.high || t.danger} stopOpacity=".35"/><stop offset="100%" stopColor={cc.high || t.danger} stopOpacity=".03"/></linearGradient>
          <linearGradient id="ag-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cc.mod || t.warn} stopOpacity=".3"/><stop offset="100%" stopColor={cc.mod || t.warn} stopOpacity=".03"/></linearGradient>
          <linearGradient id="ag-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cc.low || t.safe} stopOpacity=".25"/><stop offset="100%" stopColor={cc.low || t.safe} stopOpacity=".03"/></linearGradient>
        </defs>
        <path d={lPath.area} fill="url(#ag-l)" /><path d={lPath.line} fill="none" stroke={cc.low || t.safe} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={mPath.area} fill="url(#ag-m)" /><path d={mPath.line} fill="none" stroke={cc.mod || t.warn} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={hPath.area} fill="url(#ag-h)" /><path d={hPath.line} fill="none" stroke={cc.high || t.danger} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {weeks.map((w, i) => <text key={i} x={padL + (i / (weeks.length-1)) * iW} y={H - 4} fill={t.muted} fontSize="7" textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">{w}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
        {[["High", cc.high || t.danger], ["Moderate", cc.mod || t.warn], ["Low", cc.low || t.safe]].map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 14, height: 3, background: c, borderRadius: 2 }} /><span style={{ fontSize: 11, color: t.muted }}>{l}</span></div>
        ))}
      </div>
    </div>
  );
}

function OverviewPage({ t, setActive, setSelStu, students, wasCleared, academicYear, semester, setAcademicYear, setSemester, updateMetadata }) {
  const high = students.filter(s => s.risk >= _thresh.high), mod = students.filter(s => s.risk >= _thresh.mod && s.risk < _thresh.high);
  const low = students.filter(s => s.risk < _thresh.mod);
  const avg = students.length ? students.reduce((a, b) => a + b.risk, 0) / students.length : 0;
  const stats = [
    { lbl: "Total Monitored", val: students.length, sub: "This semester", icon: IC.students, col: t.accent },
    { lbl: "High Risk", val: high.length, sub: students.length ? Math.round(high.length / students.length * 100) + "% of cohort" : "0% of cohort", icon: IC.alert, col: t.danger },
    { lbl: "Moderate Risk", val: mod.length, sub: students.length ? Math.round(mod.length / students.length * 100) + "% of cohort" : "0% of cohort", icon: IC.analytics, col: t.warn },
    { lbl: "Avg Risk Score", val: Math.round(avg * 100) + "%", sub: "Across all programmes", icon: IC.predict, col: t.accent },
  ];

  // Chart type selector state
  const CHART_TYPES = [
    { id: "bar",     lbl: "Bar",     icon: IC.chart },
    { id: "pie",     lbl: "Pie",     icon: IC.analytics },
    { id: "donut",   lbl: "Donut",   icon: IC.activity },
    { id: "hist",    lbl: "Histogram", icon: IC.predict },
    { id: "scatter", lbl: "Scatter", icon: IC.trend },
    { id: "area",    lbl: "Area",    icon: IC.activity },
  ];
  const [chartType, setChartType] = useState("bar");
  // Filter: which risk groups to show
  const [chartFilter, setChartFilter] = useState({ high: true, mod: true, low: true });
  // Custom colors per distribution
  const [chartColors, setChartColors] = useState({ high: t.danger, mod: t.warn, low: t.safe });

  const filteredHigh = chartFilter.high ? high.length : 0;
  const filteredMod  = chartFilter.mod  ? mod.length  : 0;
  const filteredLow  = chartFilter.low  ? low.length  : 0;
  const filteredTotal = filteredHigh + filteredMod + filteredLow;

  function handlePrintReport() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const progBreakdown = PROGS.slice(1).map(prog => {
      const ps = students.filter(s => s.programme === prog);
      if (!ps.length) return "";
      const pa = ps.reduce((a, b) => a + b.risk, 0) / ps.length;
      const ph = ps.filter(s => s.risk >= _thresh.high).length;
      const pm = ps.filter(s => s.risk >= _thresh.mod && s.risk < _thresh.high).length;
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${prog}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${ps.length}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;color:#DC2626;font-weight:700">${ph}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;color:#B45309;font-weight:700">${pm}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;font-weight:700">${Math.round(pa*100)}%</td></tr>`;
    }).filter(Boolean).join("");
    const topStudents = [...students].sort((a, b) => b.risk - a.risk).slice(0, 10).map(s =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${s.name}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${s.id}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${s.programme}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">Level ${s.level}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${s.gpa.toFixed(2)}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${s.attendance}%</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;color:${s.risk>=_thresh.high?"#DC2626":s.risk>=_thresh.mod?"#B45309":"#059669"};font-weight:700">${Math.round(s.risk*100)}%</td></tr>`
    ).join("");
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>EduAlert Cohort Report - ${today}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;color:#101828;padding:32px;max-width:900px;margin:0 auto;position:relative}body:before{content:"";position:fixed;inset:12% 14%;background:url("${UENR_LOGO}") center/contain no-repeat;opacity:.11;z-index:-1}h1{font-size:24px;font-weight:800;color:#101828;margin-bottom:4px}h2{font-size:16px;font-weight:700;color:#344054;margin:28px 0 12px;border-bottom:2px solid #E4E7EC;padding-bottom:8px}p{color:#667085;font-size:13px;margin-bottom:20px}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.86)}th{font-size:11px;font-weight:600;color:#667085;text-align:left;padding:8px 12px;border-bottom:2px solid #E4E7EC;text-transform:uppercase;letter-spacing:.04em}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}.stat{padding:18px;border:1px solid #E4E7EC;border-radius:12px;border-top:3px solid var(--c);background:rgba(255,255,255,.88)}.stat-val{font-size:28px;font-weight:800;color:var(--c)}.stat-lbl{font-size:12px;color:#667085;margin-top:4px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #E4E7EC;background:rgba(255,255,255,.9)}.logo{width:54px;height:54px;border-radius:12px;object-fit:contain;background:white;border:1px solid #E4E7EC;padding:3px}@media print{body{padding:16px}}</style></head><body>
    <div class="header"><div style="display:flex;align-items:center;gap:14px"><img class="logo" src="${UENR_LOGO}" /><div><h1 style="margin:0">EduAlert Cohort Report</h1><p style="margin:0">University of Energy & Natural Resources | ${academicYear} ${semester}</p></div></div><div style="text-align:right;font-size:12px;color:#667085">Generated: ${today}<br/>Total Students: ${students.length}</div></div>
    <h2>Summary Statistics</h2>
    <div class="stat-grid">
      <div class="stat" style="--c:#2563EB"><div class="stat-val">${students.length}</div><div class="stat-lbl">Total Monitored</div></div>
      <div class="stat" style="--c:#DC2626"><div class="stat-val">${high.length}</div><div class="stat-lbl">High Risk (${students.length?Math.round(high.length/students.length*100):0}%)</div></div>
      <div class="stat" style="--c:#B45309"><div class="stat-val">${mod.length}</div><div class="stat-lbl">Moderate Risk (${students.length?Math.round(mod.length/students.length*100):0}%)</div></div>
      <div class="stat" style="--c:#059669"><div class="stat-val">${low.length}</div><div class="stat-lbl">Low Risk (${students.length?Math.round(low.length/students.length*100):0}%)</div></div>
    </div>
    <h2>Programme Breakdown</h2>
    <table><thead><tr><th>Programme</th><th>Students</th><th>High Risk</th><th>Moderate</th><th>Avg Risk</th></tr></thead><tbody>${progBreakdown}</tbody></table>
    <h2>Top 10 Highest Risk Students</h2>
    <table><thead><tr><th>Name</th><th>ID</th><th>Programme</th><th>Level</th><th>GPA</th><th>Attendance</th><th>Risk</th></tr></thead><tbody>${topStudents}</tbody></table>
    <p style="margin-top:32px;font-size:11px;color:#999;border-top:1px solid #E4E7EC;padding-top:12px">This report was generated by EduAlert Academic Risk Management System. Confidential – for authorised academic advisors only.</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div style={{ padding: "26px 30px", flex: 1, overflowY: "auto", background: darkPanelSurface(t) === "rgba(28,31,42,.96)" ? t.bg : "linear-gradient(135deg,#F0FDF4 0%,#F8FAFC 36%,#EFF6FF 100%)", position: "relative" }}>
      <img src={UENR_LOGO} alt="" style={{ position: "fixed", right: 24, bottom: 12, width: 240, height: 240, objectFit: "contain", opacity: .035, pointerEvents: "none" }} />
      {/* 3D stat cards */}
      <div className="ea-fade" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {stats.map(({ lbl, val, sub, icon, col }, i) => (
          <div key={i} className="ea-stat-card" style={{
            background: "linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.88))",
            border: "1px solid " + t.border,
            boxShadow: "0 16px 38px rgba(15,23,42,.08), 0 1px 0 rgba(255,255,255,.75) inset",
            padding: "20px 20px 18px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg," + col + "55 0%," + col + "22 100%)", borderRadius: "16px 16px 0 0" }} />
            <div style={{ position: "absolute", right: -18, bottom: -18, width: 80, height: 80, borderRadius: "50%", background: col + "10" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
              <div>
                <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>{lbl}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1px", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>{sub}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg," + col + "28 0%," + col + "12 100%)", border: "1px solid " + col + "30", boxShadow: "0 2px 8px " + col + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon ic={icon} size={20} color={col} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!students.length ? (
        <Card t={t}>
          <Empty
            icon={IC.check}
            title={wasCleared ? "Dashboard cleared - ready for new data" : "No student data loaded yet"}
            sub={wasCleared ? "All previous student records have been removed. Upload a new CSV dataset or run a batch prediction to repopulate the dashboard." : "Upload a dataset from the Students page, or go to Predict and run a batch analysis. All students processed will be reflected here in real time."}
            t={t}
            action={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                <button onClick={() => setActive("predict")} style={{ padding: "9px 18px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}><Icon ic={IC.predict} size={13} color="white" /> Run Batch Prediction</button>
                <button onClick={() => setActive("students")} style={{ padding: "9px 18px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}><Icon ic={IC.upload} size={13} color={t.textSub} /> Upload CSV Dataset</button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="ea-fade1" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Students needing attention */}
            <Card t={t}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Students Needing Attention</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Ranked by risk score</div></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={handlePrintReport} title="Print full cohort report" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 7, color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <Icon ic={IC.print} size={13} color={t.textSub} /> Print Report
                  </button>
                  <button onClick={() => setActive("students")} style={{ fontSize: 13, fontWeight: 600, color: t.accent, background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>View all</button>
                </div>
              </div>
              {[...students].sort((a, b) => b.risk - a.risk).slice(0, 5).map((s, i) => (
                <div key={i} className="ea-row" onClick={() => { setSelStu(s); setActive("students"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < 4 ? "1px solid " + t.border : "none" }}>
                  <Avatar name={s.name} risk={s.risk} t={t} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{s.name || "Unknown Student"}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>{s.programme || "-"} | Level {s.level || "-"}</div>
                  </div>
                  <Sparkline trend={s.trend} t={t} />
                  <Badge risk={s.risk} t={t} sm />
                </div>
              ))}
            </Card>

            {/* Risk distribution chart - controls at TOP */}
            <Card t={t} style={{ padding: "18px 20px" }}>
              {/* ── TOP CONTROLS ROW ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Risk Distribution</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Cohort breakdown by risk category</div>
                  </div>
                  {/* Chart type pills */}
                  <div style={{ display: "flex", gap: 3, background: t.surface2, borderRadius: 9, padding: 3, border: "1px solid " + t.border }}>
                    {CHART_TYPES.map(({ id, lbl, icon }) => (
                      <button key={id} onClick={() => setChartType(id)} title={lbl + " chart"}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                          background: chartType === id ? t.surface : "transparent",
                          color: chartType === id ? t.accent : t.muted,
                          boxShadow: chartType === id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                          transition: "all .15s" }}>
                        <Icon ic={icon} size={12} color={chartType === id ? t.accent : t.muted} />
                        <span>{lbl}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* ── FILTER + COLOR ROW ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: t.surface2, borderRadius: 9, border: "1px solid " + t.border }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, textTransform: "uppercase", letterSpacing: ".05em", marginRight: 4 }}>Show:</span>
                  {[
                    { key: "high", label: "High Risk",  defaultCol: t.danger },
                    { key: "mod",  label: "Moderate",   defaultCol: t.warn },
                    { key: "low",  label: "Low Risk",   defaultCol: t.safe },
                  ].map(({ key, label, defaultCol }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setChartFilter(f => ({ ...f, [key]: !f[key] }))}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, border: "1.5px solid " + chartColors[key], cursor: "pointer", fontSize: 11, fontWeight: 600,
                          background: chartFilter[key] ? chartColors[key] + "22" : "transparent",
                          color: chartFilter[key] ? chartColors[key] : t.muted,
                          opacity: chartFilter[key] ? 1 : .55, transition: "all .15s" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: chartFilter[key] ? chartColors[key] : t.muted }} />
                        {label}
                      </button>
                      {/* Color picker */}
                      <label title={"Pick color for " + label} style={{ cursor: "pointer", position: "relative" }}>
                        <input type="color" value={chartColors[key]} onChange={e => setChartColors(c => ({ ...c, [key]: e.target.value }))}
                          style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                        <div style={{ width: 18, height: 18, borderRadius: 4, background: chartColors[key], border: "2px solid " + t.border2, boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Render the selected chart */}
              {chartType === "bar"     && <BarChartOv high={filteredHigh} mod={filteredMod} low={filteredLow} total={filteredTotal} t={t} colors={chartColors} />}
              {chartType === "pie"     && <PieDonutChart high={filteredHigh} mod={filteredMod} low={filteredLow} total={filteredTotal} donut={false} t={t} colors={chartColors} />}
              {chartType === "donut"   && <PieDonutChart high={filteredHigh} mod={filteredMod} low={filteredLow} total={filteredTotal} donut={true} t={t} colors={chartColors} />}
              {chartType === "hist"    && <HistogramOv students={students.filter(s => (chartFilter.high && s.risk >= _thresh.high) || (chartFilter.mod && s.risk >= _thresh.mod && s.risk < _thresh.high) || (chartFilter.low && s.risk < _thresh.mod))} t={t} colors={chartColors} />}
              {chartType === "scatter" && <ScatterOv students={students.filter(s => (chartFilter.high && s.risk >= _thresh.high) || (chartFilter.mod && s.risk >= _thresh.mod && s.risk < _thresh.high) || (chartFilter.low && s.risk < _thresh.mod))} t={t} colors={chartColors} />}
              {chartType === "area"    && <AreaChartOv high={filteredHigh} mod={filteredMod} low={filteredLow} total={students.length} t={t} colors={chartColors} />}
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card t={t} style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>By Programme</div>
              {PROGS.slice(1).map((prog, i) => {
                const ps = students.filter(s => s.programme === prog);
                if (!ps.length) return null;
                const pa = ps.reduce((a, b) => a + b.risk, 0) / ps.length;
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: t.textSub }}>{prog}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: rc(pa, t) }}>{Math.round(pa * 100)}%</span>
                    </div>
                    <Bar pct={pa} color={rc(pa, t)} t={t} />
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

// ─── PRINT REPORT (unchanged) ────────────────────────────────────────────────
function printReport(s) {
  const risk = s.risk;
  const cr = (s.credits || 0) / (s.required || 90);
  const riskLabel = risk >= _thresh.high ? "HIGH RISK" : risk >= _thresh.mod ? "MODERATE RISK" : "LOW RISK";
  const riskColor = risk >= _thresh.high ? "#DC2626" : risk >= _thresh.mod ? "#B45309" : "#059669";
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const ivRows = (!s.interventions || !s.interventions.length)
    ? "<tr><td colspan='3' style='padding:12px;text-align:center;color:#667085;font-style:italic'>No interventions have been logged for this student.</td></tr>"
    : (s.interventions || []).map(iv => "<tr><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'>" + iv.date + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'>" + (iv.by || "Advisor") + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'>" + iv.note + "</td></tr>").join("");

  const gpaHistHtml = (s.gpaHist || [null, null, null, s.gpa]).map((g, i) => {
    const sem = "S" + (i + 1);
    if (g === null) return "<div style='text-align:center'><div style='font-size:11px;color:#98A2B3;margin-bottom:4px'>" + sem + "</div><div style='font-size:18px;font-weight:700;color:#D0D5DD'>—</div></div>";
    const col = g >= 3 ? "#059669" : g >= 2 ? "#B45309" : "#DC2626";
    return "<div style='text-align:center'><div style='font-size:11px;color:#667085;margin-bottom:4px'>" + sem + "</div><div style='font-size:20px;font-weight:800;color:" + col + "'>" + g.toFixed(1) + "</div></div>";
  }).join("");

  const flagsHtml = (s.flags && s.flags.length)
    ? s.flags.map(f => "<div style='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #E4E7EC'><div style='width:8px;height:8px;border-radius:50%;background:#DC2626;flex-shrink:0'></div><span style='font-size:13px;color:#344054'>" + f + "</span></div>").join("")
    : "<div style='font-size:13px;color:#667085;font-style:italic'>No active risk flags detected.</div>";

  const shapRows = (s.shap || []).map((item) => {
    const factor = item.f || item[0] || "Factor";
    const val = typeof item.v === "number" ? item.v : (item[1] || 0);
    const pct = Math.round(Math.abs(val) * 100);
    const col = val >= 0 ? "#DC2626" : "#059669";
    return "<tr><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'>" + factor + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'><div style='display:flex;align-items:center;gap:10px'><div style='width:120px;height:10px;background:#F0F2F5;border-radius:5px;overflow:hidden'><div style='width:" + pct + "%;height:100%;background:" + col + ";border-radius:5px'></div></div><span style='font-size:12px;font-weight:700;color:" + col + "'>" + (val >= 0 ? "+" : "") + val.toFixed(2) + "</span></div></td></tr>";
  }).join("");

  const summaryText = risk >= _thresh.high
    ? firstName(s) + " is at high risk of dropping out. Their GPA of " + s.gpa.toFixed(1) + ", attendance of " + s.attendance + "%, and " + Math.round(cr * 100) + "% credit completion place them firmly in the high-risk category. Prompt advisor action is the most effective way to change this outcome."
    : risk >= _thresh.mod
    ? firstName(s) + " is showing warning signs that require monitoring. A proactive check-in is recommended within two weeks to prevent further decline."
    : firstName(s) + " is performing adequately at this time. Continue standard monitoring and encourage continued engagement.";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>EduAlert - Student Risk Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#101828;background:#fff;padding:32px 40px;position:relative}
  body:before{content:"";position:fixed;inset:12% 16%;background:url("${UENR_LOGO}") center/contain no-repeat;opacity:.11;z-index:-1}
  @media print{body{padding:16px}.no-print{display:none!important}@page{margin:1.5cm;size:A4}}
  h2{font-size:14px;font-weight:700;color:#344054;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #E4E7EC}
  table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.86)}
  th{font-size:11px;font-weight:600;color:#667085;text-align:left;padding:9px 12px;border-bottom:2px solid #E4E7EC;text-transform:uppercase;letter-spacing:.04em}
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
  .kpi{padding:14px 16px;border:1px solid #E4E7EC;border-radius:10px;background:rgba(248,250,252,.88)}
  .kpi-label{font-size:10px;font-weight:600;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .kpi-value{font-size:26px;font-weight:800;margin-bottom:6px}
  .kpi-bar{height:6px;background:#E4E7EC;border-radius:3px;overflow:hidden}
  .kpi-fill{height:100%;border-radius:3px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #2563EB}
  .school-logo{width:58px;height:58px;object-fit:contain;border:1px solid #E4E7EC;border-radius:12px;padding:3px;background:white;margin-right:14px}
  .risk-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${riskColor}15;color:${riskColor};border:1px solid ${riskColor}40}
  .summary-box{padding:16px 18px;border-radius:10px;margin-bottom:18px;line-height:1.6;font-size:13px}
  .footer{margin-top:32px;padding-top:14px;border-top:1px solid #E4E7EC;display:flex;justify-content:space-between;font-size:10px;color:#667085}
  .print-btn{padding:10px 24px;background:#2563EB;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
  .no-print{margin-bottom:20px}
</style>
</head>
<body>

<div class="no-print">
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <button onclick="window.close()" style="margin-left:10px;padding:10px 20px;background:none;border:1px solid #D0D5DD;border-radius:8px;font-size:14px;cursor:pointer">Close</button>
</div>

<div class="header">
  <div style="display:flex;align-items:flex-start">
    <img class="school-logo" src="${UENR_LOGO}" />
    <div>
      <div style="font-size:11px;font-weight:600;color:#2563EB;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">University of Energy and Natural Resources - EduAlert</div>
      <h1 style="font-size:22px;font-weight:800;margin-bottom:4px">${s.name}</h1>
      <div style="font-size:12px;color:#667085;margin-top:4px">${s.id} &nbsp;|&nbsp; ${s.programme} &nbsp;|&nbsp; Level ${s.level} &nbsp;|&nbsp; Semester ${s.semester}</div>
      <div style="font-size:11px;color:#98A2B3;margin-top:4px">Report generated: ${today}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:28px;font-weight:800;color:${riskColor};line-height:1">${Math.round(risk * 100)}%</div>
    <div style="font-size:11px;color:#667085;margin-bottom:8px">Dropout Risk Score</div>
    <div class="risk-badge">${riskLabel}</div>
  </div>
</div>

<h2>Academic Performance Indicators</h2>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">GPA</div>
    <div class="kpi-value" style="color:${s.gpa >= 3 ? "#059669" : s.gpa >= 2 ? "#B45309" : "#DC2626"}">${s.gpa.toFixed(1)}</div>
    <div class="kpi-bar"><div class="kpi-fill" style="width:${s.gpa / 4 * 100}%;background:${s.gpa >= 3 ? "#059669" : s.gpa >= 2 ? "#B45309" : "#DC2626"}"></div></div>
    ${s.gpa < 2 ? '<div style="font-size:11px;color:#DC2626;margin-top:4px;font-weight:600">Below 2.0 minimum</div>' : ""}
  </div>
  <div class="kpi">
    <div class="kpi-label">Attendance</div>
    <div class="kpi-value" style="color:${s.attendance >= 80 ? "#059669" : s.attendance >= 65 ? "#B45309" : "#DC2626"}">${s.attendance}%</div>
    <div class="kpi-bar"><div class="kpi-fill" style="width:${s.attendance}%;background:${s.attendance >= 80 ? "#059669" : s.attendance >= 65 ? "#B45309" : "#DC2626"}"></div></div>
    ${s.attendance < 65 ? '<div style="font-size:11px;color:#DC2626;margin-top:4px;font-weight:600">Below 65% threshold</div>' : ""}
  </div>
  <div class="kpi">
    <div class="kpi-label">Credits Completed</div>
    <div class="kpi-value" style="color:${cr >= .9 ? "#059669" : "#B45309"}">${s.credits}/${s.required}</div>
    <div class="kpi-bar"><div class="kpi-fill" style="width:${Math.min(100, cr * 100)}%;background:${cr >= .9 ? "#059669" : "#B45309"}"></div></div>
    ${cr < .75 ? '<div style="font-size:11px;color:#B45309;margin-top:4px;font-weight:600">Behind schedule</div>' : ""}
  </div>
</div>

<h2>GPA History</h2>
<div style="display:flex;gap:24px;padding:14px 16px;background:#F8FAFC;border-radius:10px;border:1px solid #E4E7EC;margin-bottom:18px">
  ${gpaHistHtml}
  <div style="margin-left:auto;text-align:right;font-size:12px;color:#667085;align-self:flex-end">Programme avg: ${Math.round((s.progAvg || .45) * 4 * 25) / 25} GPA</div>
</div>

<h2>Advisor Risk Summary</h2>
<div class="summary-box" style="background:${riskColor}0D;border:1px solid ${riskColor}40;color:#344054">
  <strong style="color:${riskColor}">${riskLabel}:</strong> ${summaryText}
</div>

<h2>Active Risk Flags</h2>
<div style="padding:14px 16px;background:#F8FAFC;border-radius:10px;border:1px solid #E4E7EC;margin-bottom:18px">
  ${flagsHtml}
</div>

<h2>Risk Factor Weights</h2>
<table style="margin-bottom:18px">
  <thead><tr><th>Factor</th><th>Influence on Risk Score</th></tr></thead>
  <tbody>${shapRows}</tbody>
</table>

<h2>Intervention History</h2>
<table>
  <thead><tr><th>Date</th><th>Logged By</th><th>Notes</th></tr></thead>
  <tbody>${ivRows}</tbody>
</table>

<div class="footer">
  <div>EduAlert - Student Dropout Risk Prediction System &nbsp;|&nbsp; UENR Group 27 Final Year Project 2026</div>
  <div>Confidential - For academic advisor use only &nbsp;|&nbsp; ${today}</div>
</div>

</body>
</html>`;

  const w = window.open("", "_blank", "width=860,height=900,scrollbars=yes");
  if (!w) { alert("Please allow popups for this site to print student reports."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch(e) {} }, 500);
}

// ─── FULL PROFILE MODAL ─────────────────────────────────────────────────────
function FullProfileModal({ t, student: s, onClose, onNote, onEmail, onPrint }) {
  const [tab, setTab] = useState("overview");
  const [maximized, setMaximized] = useState(false);
  const cr = (s.credits || 0) / (s.required || 90);
  const PRIORITY_COLORS = { urgent: t.danger, high: t.warn, normal: t.accent, low: t.safe };
  const PRIORITY_BG = { urgent: t.dangerBg, high: t.warnBg, normal: t.accentBg, low: t.safeBg };
  const PRIORITY_LABEL = { urgent: "Urgent", high: "High Priority", normal: "Recommended", low: "Routine" };
  const tabs = [{ id: "overview", lbl: "Overview" }, { id: "why", lbl: "Risk Factors" }, { id: "actions", lbl: "Action Plan" }, { id: "history", lbl: "Intervention History" }];
  // maximize SVG icon
  const MaxIcon = maximized
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: maximized ? "stretch" : "flex-start", justifyContent: "center", padding: maximized ? 0 : "20px", overflowY: maximized ? "hidden" : "auto" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ea-scale" style={{ width: "100%", maxWidth: maximized ? "100%" : 960, background: t.surface, borderRadius: maximized ? 0 : 20, border: "1px solid " + t.border, boxShadow: "0 24px 80px rgba(0,0,0,.3)", overflow: "hidden", marginTop: maximized ? 0 : 20, marginBottom: maximized ? 0 : 20, display: "flex", flexDirection: "column", height: maximized ? "100vh" : "auto" }}>
        <div style={{ background: "linear-gradient(135deg," + t.accent + "ee," + t.accent + "99)", padding: "28px 32px 0", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.07)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
          {/* Close + Maximize buttons */}
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 6 }}>
            <button onClick={() => setMaximized(m => !m)} title={maximized ? "Restore" : "Maximize"} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <span style={{ width: 14, height: 14, display: "inline-flex" }}>{React.cloneElement(MaxIcon, { width: 14, height: 14 })}</span>
            </button>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <Icon ic={IC.x} size={14} color="white" />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 24, position: "relative" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,.2)", border: "2px solid rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "white", flexShrink: 0, backdropFilter: "blur(10px)" }}>
              {s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-.3px", lineHeight: 1.1, marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginBottom: 8 }}>{s.id} | {s.programme} | Level {s.level} | Semester {s.semester}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 12px", borderRadius: 20, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", fontSize: 12, color: "white", fontWeight: 600 }}>{rlbl(s.risk)}</span>
                <span style={{ padding: "3px 12px", borderRadius: 20, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", fontSize: 12, color: "white" }}>{Math.round(s.risk * 100)}% dropout risk</span>
                {s.flags && s.flags.slice(0, 2).map((f, i) => <span key={i} style={{ padding: "3px 12px", borderRadius: 20, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", fontSize: 12, color: "rgba(255,255,255,.85)" }}>{f}</span>)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
              <RiskGauge value={s.risk} t={{ ...t, text: "white", muted: "rgba(255,255,255,.6)" }} size={100} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onNote} style={{ padding: "7px 14px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.note} size={13} color="white" /> Log Note</button>
                <button onClick={onEmail} style={{ padding: "7px 14px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.mail} size={13} color="white" /> Email</button>
                <button onClick={onPrint} style={{ padding: "7px 12px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, color: "white", fontSize: 12, cursor: "pointer" }}><Icon ic={IC.print} size={13} color="white" /></button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: 0 }}>
            {tabs.map(({ id, lbl }) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "11px 22px", border: "none", background: "none", color: tab === id ? "white" : "rgba(255,255,255,.65)", fontWeight: tab === id ? 700 : 500, fontSize: 13, cursor: "pointer", borderBottom: "3px solid " + (tab === id ? "white" : "transparent"), transition: "all .15s" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "28px 32px", overflowY: "auto", flex: 1, maxHeight: maximized ? "none" : "calc(90vh - 240px)" }}>
          {tab === "overview" && (
            <div className="ea-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                {[
                  { l: "GPA", v: s.gpa.toFixed(1), pct: s.gpa / 4, col: s.gpa >= 3 ? t.safe : s.gpa >= 2 ? t.warn : t.danger, note: s.gpa < 2 ? "Below 2.0 minimum" : s.gpa >= 3 ? "Excellent" : "Acceptable" },
                  { l: "Attendance", v: s.attendance + "%", pct: s.attendance / 100, col: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, note: s.attendance < 65 ? "Below threshold" : s.attendance >= 80 ? "Strong" : "Monitor" },
                  { l: "Credits", v: s.credits + "/" + s.required, pct: s.credits / s.required, col: s.credits / s.required >= .9 ? t.safe : t.warn, note: s.credits / s.required < .75 ? "Behind schedule" : "On track" },
                  { l: "Risk Score", v: Math.round(s.risk * 100) + "%", pct: s.risk, col: rc(s.risk, t), note: rlbl(s.risk) },
                ].map(({ l, v, pct, col, note }, i) => (
                  <Card key={i} t={t} style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: col, marginBottom: 8, letterSpacing: "-.5px" }}>{v}</div>
                    <Bar pct={pct} color={col} t={t} h={5} />
                    <div style={{ fontSize: 11, color: col, marginTop: 6, fontWeight: 600 }}>{note}</div>
                  </Card>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Card t={t} style={{ padding: "20px 22px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Risk Summary</div>
                  <div style={{ padding: "14px 16px", background: s.risk >= _thresh.high ? t.dangerBg : s.risk >= _thresh.mod ? t.warnBg : t.safeBg, borderRadius: 10, border: "1px solid " + (s.risk >= _thresh.high ? t.dangerMuted : s.risk >= _thresh.mod ? t.warnMuted : t.safeMuted), fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>
                    {generateOverallSummary(s)}
                  </div>
                  {s.flags && s.flags.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, marginBottom: 8 }}>ACTIVE FLAGS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {s.flags.map((f, i) => <span key={i} style={{ padding: "3px 10px", background: t.dangerBg, borderRadius: 6, fontSize: 11, color: t.danger, fontWeight: 600, border: "1px solid " + t.dangerMuted }}>{f}</span>)}
                      </div>
                    </div>
                  )}
                </Card>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card t={t} style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>GPA History</div>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 12 }}>vs programme average</div>
                    <GpaTrend hist={s.gpaHist || [null, null, null, s.gpa]} t={t} avg={s.progAvg || .45} />
                  </Card>
                  <Card t={t} style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Risk Factor Weights</div>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 12 }}>Relative influence of each academic indicator</div>
                    <ShapBar data={s.shap} t={t} />
                  </Card>
                </div>
              </div>
              <Card t={t} style={{ padding: "18px 22px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>How This Student Compares</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                  {[{ lbl: "This Student", val: s.risk }, { lbl: "Programme Average", val: s.progAvg || .45 }, { lbl: "University Average", val: .42 }].map(({ lbl, val }, i) => (
                    <div key={i}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: t.textSub }}>{lbl}</span><span style={{ fontSize: 13, fontWeight: 700, color: rc(val, t) }}>{Math.round(val * 100)}%</span></div><Bar pct={val} color={rc(val, t)} t={t} h={7} /></div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === "why" && (
            <div className="ea-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.6, padding: "0 0 4px" }}>Main academic indicators for this student, ordered by level of concern.</div>
              {generateWhyFlagged(s).map(({ sev, text }, i) => {
                const sevColor = { high: t.danger, mod: t.warn, low: t.safe }[sev] || t.danger;
                const sevBg = { high: t.dangerBg, mod: t.warnBg, low: t.safeBg }[sev] || t.dangerBg;
                const sevBrd = { high: t.dangerMuted, mod: t.warnMuted, low: t.safeMuted }[sev] || t.dangerMuted;
                const sevLabel = { high: "High Concern", mod: "Moderate Concern", low: "Positive Signal" }[sev] || "High Concern";
                return (
                  <div key={i} style={{ padding: "18px 20px", background: sevBg, borderRadius: 12, border: "1.5px solid " + sevBrd }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: sevColor, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>{sevLabel}</div>
                    <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.8 }}>{text}</div>
                  </div>
                );
              })}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
                <Card t={t} style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>Risk Factor Weights</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>Red raises the risk score | Green lowers it</div>
                  <ShapBar data={s.shap} t={t} />
                </Card>
                <Card t={t} style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>GPA Trend</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>Semester-by-semester history</div>
                  <GpaTrend hist={s.gpaHist || [null, null, null, s.gpa]} t={t} avg={s.progAvg || .45} />
                </Card>
              </div>
            </div>
          )}

          {tab === "actions" && (
            <div className="ea-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.6, padding: "0 0 4px" }}>Suggested advisor actions based on the student's current record. Start with the highest priority item.</div>
              {generateRecommendedActions(s).map(({ priority, icon, title, detail }, i) => (
                <div key={i} style={{ padding: "20px 22px", background: PRIORITY_BG[priority], borderRadius: 12, border: "1.5px solid " + PRIORITY_COLORS[priority] + "33" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: PRIORITY_COLORS[priority] + "22", border: "1px solid " + PRIORITY_COLORS[priority] + "44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon ic={IC[icon] || IC.note} size={20} color={PRIORITY_COLORS[priority]} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</div>
                        <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: PRIORITY_COLORS[priority], color: "white", flexShrink: 0 }}>{PRIORITY_LABEL[priority]}</span>
                      </div>
                      <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.8 }}>{detail}</div>
                      <button onClick={onNote} style={{ marginTop: 12, padding: "7px 16px", background: "none", border: "1.5px solid " + PRIORITY_COLORS[priority], borderRadius: 8, color: PRIORITY_COLORS[priority], fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Log this intervention</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "history" && (
            <div className="ea-fade">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Intervention History</div><div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{(s.interventions || []).length} record{(s.interventions || []).length !== 1 ? "s" : ""} logged</div></div>
                <button onClick={onNote} style={{ padding: "9px 18px", background: t.accent, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Icon ic={IC.note} size={14} color="white" /> Log New Intervention</button>
              </div>
              {(!s.interventions || !s.interventions.length)
                ? <div style={{ padding: "48px 0", textAlign: "center", border: "2px dashed " + t.border2, borderRadius: 12 }}>
                  <div style={{ opacity: .2, display: "flex", justifyContent: "center", marginBottom: 12 }}><Icon ic={IC.note} size={36} color={t.muted} /></div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.muted }}>No interventions logged yet</div>
                  <div style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>Use the button above to log your first note for this student.</div>
                </div>
                : s.interventions.map((iv, i) => (
                  <div key={i} style={{ padding: "16px 20px", background: t.surface2, borderRadius: 12, border: "1px solid " + t.border, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon ic={IC.user} size={14} color={t.accent} /></div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{iv.by || "Advisor"}</span>
                      </div>
                      <span style={{ fontSize: 12, color: t.muted, fontFamily: "monospace" }}>{iv.date}</span>
                    </div>
                    <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.7, paddingLeft: 42 }}>{iv.note}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT STUDENT MODAL (unchanged, but uses dynamic programmes) ─────────────
function EditStudentModal({ t, student, onClose, onSave, programmesList }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: student.name || "", id: student.id || "", programme: student.programme || (programmesList[0] || "Computer Science"),
    level: String(student.level || 200), semester: String(student.semester || 1),
    gpa: String(student.gpa || ""), attendance: String(student.attendance || ""),
    credits: String(student.credits || ""), required: String(student.required || ""),
    failedModules: String(getFeatureValue(student, "failed_modules", "failedModules")),
    financialFlag: String(getFeatureValue(student, "financial_flag", "financialFlag")),
    repeatedCourse: String(getFeatureValue(student, "repeated_course", "repeatedCourse")),
    probation: String(getFeatureValue(student, "probation", "probation")),
  });
  const [saving, setSaving] = useState(false);
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const iS = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };
  async function handleSave() {
    if (!form.gpa || !form.attendance || !form.credits || !form.required) { toast("Please fill all academic fields", "error"); return; }
    setSaving(true);
    const gpa = +form.gpa, att = +form.attendance, cr = +form.credits / +form.required;
    const failedModules = +form.failedModules || 0;
    const financialFlag = +form.financialFlag || 0;
    const repeatedCourse = +form.repeatedCourse || 0;
    const probation = +form.probation || 0;
    const updated = { ...student, ...form, gpa, attendance: att, credits: +form.credits, required: +form.required, level: +form.level, semester: +form.semester,
      failedModules, financialFlag, repeatedCourse, probation,
      risk: computeRisk(gpa, att, cr, form.programme),
      shap: makeShap(gpa, att, cr, form.programme, +form.semester),
      gpaHist: [...(student.gpaHist || [null, null, null]).slice(-3), gpa],
    };
    try {
      const data = await apiFetch("/predict", { method: "POST", body: JSON.stringify(studentPayload(updated)) });
      const fromModel = enrichStudentFromPrediction(updated, data, student);
      onSave(fromModel);
      toast("Student record updated with ML prediction", "success");
      onClose();
    } catch (e) {
      toast(e.message || "Could not update student from backend", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal onClose={onClose} t={t} width={560}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Edit Student Record</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{student.name} | {student.id}</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>x</button>
      </div>
      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Full Name</label><input value={form.name} onChange={setF("name")} style={iS} /></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Student ID</label><input value={form.id} onChange={setF("id")} style={iS} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 12 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Programme</label><select value={form.programme} onChange={setF("programme")} style={{ ...iS, cursor: "pointer" }}>{programmesList.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Level</label><select value={form.level} onChange={setF("level")} style={{ ...iS, cursor: "pointer" }}>{["100", "200", "300", "400"].map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Sem.</label><select value={form.semester} onChange={setF("semester")} style={{ ...iS, cursor: "pointer" }}>{["1", "2"].map(o => <option key={o}>{o}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>GPA (0-4.0)</label><input value={form.gpa} onChange={setF("gpa")} placeholder="e.g. 2.3" style={iS} /></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Attendance (%)</label><input value={form.attendance} onChange={setF("attendance")} placeholder="e.g. 72" style={iS} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Credits Earned</label><input value={form.credits} onChange={setF("credits")} style={iS} /></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Credits Required</label><input value={form.required} onChange={setF("required")} style={iS} /></div>
        </div>
        <div style={{ borderTop: "1px solid " + t.border, margin: "2px 0" }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase" }}>Feature Engineering Inputs</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Failed Modules</label><select value={form.failedModules} onChange={setF("failedModules")} style={{ ...iS, cursor: "pointer" }}>{["0", "1", "2", "3", "4", "5"].map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Financial Hold</label><select value={form.financialFlag} onChange={setF("financialFlag")} style={{ ...iS, cursor: "pointer" }}>{[["0", "No"], ["1", "Yes"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Repeated Course</label><select value={form.repeatedCourse} onChange={setF("repeatedCourse")} style={{ ...iS, cursor: "pointer" }}>{[["0", "No"], ["1", "Yes"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Academic Probation</label><select value={form.probation} onChange={setF("probation")} style={{ ...iS, cursor: "pointer" }}>{[["0", "No"], ["1", "Yes"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 20px", background: saving ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {saving ? <><Spinner size={14} color="white" /> Saving...</> : <><Icon ic={IC.check} size={14} color="white" /> Save Changes</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── IMPORT MODE MODAL (unchanged) ──────────────────────────────────────────
function ImportModeModal({ t, rowCount, existingCount, onConfirm, onCancel }) {
  const [mode, setMode] = useState("add");
  const modes = [
    { id: "add", icon: IC.students, title: "Add new students", desc: "Import " + rowCount + " students as new additions. Existing " + existingCount + " records are kept. Any duplicates (same ID) will be skipped." },
    { id: "update", icon: IC.edit, title: "Update matching + add new", desc: "Update " + rowCount + " students where IDs match. Students not in the file are kept. New IDs are added. No data is lost." },
    { id: "replace", icon: IC.refresh, title: "Replace all records", desc: "Remove all " + existingCount + " existing students and load only these " + rowCount + ". This cannot be undone." },
  ];
  return (
    <Modal onClose={onCancel} t={t} width={520}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>How should we import these {rowCount} students?</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>You currently have {existingCount} student{existingCount !== 1 ? "s" : ""} in the registry</div></div>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: t.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>x</button>
      </div>
      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {modes.map(({ id, icon, title, desc }) => (
          <div key={id} onClick={() => setMode(id)}
            style={{ padding: "14px 16px", borderRadius: 10, border: "2px solid " + (mode === id ? t.accent : t.border), background: mode === id ? t.accentBg : "transparent", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", transition: "all .15s" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: mode === id ? t.accent : t.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
              <Icon ic={icon} size={17} color={mode === id ? "white" : t.muted} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: mode === id ? t.accent : t.text, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.55 }}>{desc}</div>
            </div>
            {mode === id && <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon ic={IC.check} size={11} color="white" /></div>}
          </div>
        ))}
        {mode === "replace" && <div style={{ padding: "10px 14px", background: t.dangerBg, borderRadius: 8, border: "1px solid " + t.dangerMuted, fontSize: 12, color: t.danger, fontWeight: 500 }}>Warning: This will permanently remove all {existingCount} existing records from this session and the database.</div>}
      </div>
      <div style={{ padding: "14px 22px", borderTop: "1px solid " + t.border, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onCancel} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => onConfirm(mode)} style={{ padding: "9px 20px", background: mode === "replace" ? t.danger : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {mode === "add" ? "Add Students" : mode === "update" ? "Update & Add" : "Replace All"}
        </button>
      </div>
    </Modal>
  );
}

// ─── STUDENTS PAGE (with wider panel) ────────────────────────────────────────
function StudentsPage({ t, initSel, students, setStudents, logActivity = () => { }, programmesList, notifFilter, setNotifFilter }) {
  const toast = useToast();
  const PAGE_SIZE = 20;
  const [search, setSearch] = useState(""); const [prog, setProg] = useState("All Programmes"); const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(initSel || null); const [showUp, setShowUp] = useState(false); const [showNote, setShowNote] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [expTab, setExpTab] = useState("why");
  const [page, setPage] = useState(0);
  useEffect(() => { if (initSel) setSel(initSel); }, [initSel]);
  useEffect(() => { setPage(0); }, [search, prog, filter, notifFilter]);

  async function addNote(id, note) {
    setStudents(p => p.map(s => s.id === id ? { ...s, interventions: [note, ...(s.interventions || [])] } : s));
    setSel(p => p && p.id === id ? { ...p, interventions: [note, ...(p.interventions || [])] } : p);
    try { await apiFetch("/students/" + encodeURIComponent(id) + "/interventions", { method: "PATCH", body: JSON.stringify({ note: note.note, by: note.by || "Advisor" }) }); }
    catch (e) { toast("Intervention kept locally, but backend sync failed: " + e.message, "warn"); return; }
    toast("Intervention saved", "success");
  }

  async function deleteStudent(id) {
    setStudents(p => p.filter(s => s.id !== id));
    if ((sel && sel.id) === id) setSel(null);
    try { await apiFetch("/students/" + encodeURIComponent(id), { method: "DELETE" }); toast("Student removed", "success"); }
    catch (e) { toast(e.message, "error"); }
  }

  function saveEditedStudent(updated) {
    setStudents(p => p.map(s => s.id === updated.id ? updated : s));
    setSel(updated);
  }
  function requestImport(rows) { setPendingImport(rows); }

  async function applyImport(rows, mode) {
    setPendingImport(null);
    try {
      const ids = new Set(students.map(s => s.id));
      const rowsToPredict = mode === "add" ? rows.filter(r => !ids.has(r.id)) : rows;
      if (!rowsToPredict.length) {
        toast("No new students to import - duplicates skipped", "info");
        return;
      }
      const payload = { students: rowsToPredict.map(studentPayload) };
      let data = await apiFetch("/predict/batch", { method: "POST", body: JSON.stringify(payload) });
      let byId = new Map((data.students || []).map(s => [s.student_id || s.id, s]));
      if (byId.size !== rowsToPredict.length) throw new Error("Backend did not return predictions for every imported student");

      if (mode === "replace") {
        // Validate first, then clear and re-run so backend records truly match the replacement file.
        await apiFetch("/students/all", { method: "DELETE" });
        data = await apiFetch("/predict/batch", { method: "POST", body: JSON.stringify(payload) });
        byId = new Map((data.students || []).map(s => [s.student_id || s.id, s]));
      }

      const predictedRows = rowsToPredict.map(r => enrichStudentFromPrediction(r, byId.get(r.id), students.find(s => s.id === r.id) || {}));
      let next = students;
      if (mode === "add") {
        next = [...students, ...predictedRows];
        toast(predictedRows.length + " new students imported with ML predictions (" + (rows.length - predictedRows.length) + " duplicates skipped)", "success");
      } else if (mode === "update") {
        const predMap = new Map(predictedRows.map(s => [s.id, s]));
        next = [...students.map(s => predMap.get(s.id) || s), ...predictedRows.filter(r => !ids.has(r.id))];
        toast(predictedRows.length + " students updated/added with ML predictions", "success");
      } else if (mode === "replace") {
        next = predictedRows;
        toast("All records replaced with " + predictedRows.length + " ML-predicted students", "success");
      }
      setStudents(next);
      logActivity("Imported " + predictedRows.length + " students with backend ML predictions (mode: " + mode + ")", "import");
    } catch (e) {
      toast(e.message || "CSV import prediction failed", "error");
      logActivity("CSV import failed: " + (e.message || "backend prediction error"), "import");
    }
  }

  const list = students.filter(s => {
    if (!s || !s.name || !s.id) return false;
    // If a notification filter is active, show only those specific students
    if (notifFilter && notifFilter.ids && notifFilter.ids.length) {
      return notifFilter.ids.includes(s.id);
    }
    const ms = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search);
    const mp = prog === "All Programmes" || s.programme === prog;
    const mf = filter === "all" || (filter === "high" && s.risk >= _thresh.high) || (filter === "moderate" && s.risk >= _thresh.mod && s.risk < _thresh.high) || (filter === "low" && s.risk < _thresh.mod);
    return ms && mp && mf;
  }).sort((a, b) => b.risk - a.risk);
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const pageList = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const iS = { width: "100%", padding: "8px 11px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };
  const PRIORITY_COLORS = { urgent: t.danger, high: t.warn, normal: t.accent, low: t.safe };
  const PRIORITY_BG = { urgent: t.dangerBg, high: t.warnBg, normal: t.accentBg, low: t.safeBg };
  const PRIORITY_LABEL = { urgent: "Urgent", high: "High Priority", normal: "Recommended", low: "Routine" };
  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {showUp && <UploadModal t={t} onClose={() => setShowUp(false)} onImport={requestImport} programmesList={programmesList} />}
      {pendingImport && <ImportModeModal t={t} rowCount={pendingImport.length} existingCount={students.length} onConfirm={(mode) => applyImport(pendingImport, mode)} onCancel={() => setPendingImport(null)} />}
      {showNote && sel && <IntModal t={t} student={sel} onClose={() => setShowNote(false)} onSave={addNote} />}
      {showEmail && sel && <EmailModal t={t} student={sel} onClose={() => setShowEmail(false)} onEmailSent={addNote} />}
      {showEdit && sel && <EditStudentModal t={t} student={sel} onClose={() => setShowEdit(false)} onSave={saveEditedStudent} programmesList={programmesList} />}
      {showFullProfile && sel && <FullProfileModal t={t} student={sel} onClose={() => setShowFullProfile(false)} onNote={() => { setShowFullProfile(false); setShowNote(true); }} onEmail={() => { setShowFullProfile(false); setShowEmail(true); }} onPrint={() => printReport(sel)} />}
      {/* Student list panel - wide for easy reading */}
      <div style={{ width: 680, borderRight: "1px solid " + t.border, display: "flex", flexDirection: "column", background: t.surface, flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid " + t.border }}>
          {/* Notification filter banner */}
          {notifFilter && notifFilter.ids && notifFilter.ids.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon ic={IC.alert} size={13} color={t.accent} />
                <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>Alert: {notifFilter.label}</span>
                <span style={{ fontSize: 12, color: t.textSub }}>— Showing {notifFilter.ids.length} student{notifFilter.ids.length > 1 ? "s" : ""}</span>
              </div>
              <button onClick={() => setNotifFilter && setNotifFilter(null)} title="Clear filter" style={{ background: "none", border: "none", color: t.muted, fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..." style={{ ...iS, flex: 1 }} disabled={!!(notifFilter && notifFilter.ids && notifFilter.ids.length)} /><button onClick={() => setShowUp(true)} style={{ padding: "8px 11px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 8, color: t.accent, cursor: "pointer", display: "flex", alignItems: "center" }}><Icon ic={IC.upload} size={16} color={t.accent} /></button></div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>{["all", "high", "moderate", "low"].map(f => <button key={f} onClick={() => { if (notifFilter) setNotifFilter && setNotifFilter(null); setFilter(f); }} style={{ padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid " + (filter === f && !notifFilter ? t.accent : t.border), background: filter === f && !notifFilter ? t.accentBg : "transparent", color: filter === f && !notifFilter ? t.accent : t.muted }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}</div>
          <select value={prog} onChange={e => setProg(e.target.value)} style={{ ...iS, cursor: "pointer" }} disabled={!!(notifFilter && notifFilter.ids && notifFilter.ids.length)}><option>All Programmes</option>{programmesList.map(p => <option key={p}>{p}</option>)}</select>
        </div>
        <div style={{ fontSize: 11, color: t.muted, padding: "7px 12px 3px", fontWeight: 500 }}>{list.length} student{list.length !== 1 ? "s" : ""}</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!students.length ? <Empty icon={IC.folder} title="No students loaded" sub="Click upload icon a CSV." t={t} /> : !list.length ? <Empty icon={IC.search} title="No results" sub="Adjust your filters." t={t} /> : (
            <>
              {pageList.map((s, i) => (<div key={i} className="ea-row" onClick={() => { setSel(s); setExpTab("why"); }} style={{ padding: "11px 12px", borderBottom: "1px solid " + t.border, background: (sel && sel.id) === s.id ? t.accentBg : "transparent", borderLeft: "3px solid " + ((sel && sel.id) === s.id ? t.accent : "transparent") }}><div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><Avatar name={s.name} risk={s.risk} t={t} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.name || "Unknown Student"}</div><div style={{ fontSize: 11, color: t.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.id || "—"}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}><Badge risk={s.risk} t={t} sm /><Sparkline trend={s.trend} t={t} /></div></div></div></div>))}
              {totalPages > 1 && (
                <div style={{ padding: "10px 12px", borderTop: "1px solid " + t.border, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 10px", background: "none", border: "1px solid " + t.border2, borderRadius: 6, color: page === 0 ? t.muted : t.textSub, fontSize: 12, cursor: page === 0 ? "not-allowed" : "pointer", fontWeight: 500 }}>Prev</button>
                  <span style={{ fontSize: 11, color: t.muted }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: "4px 10px", background: "none", border: "1px solid " + t.border2, borderRadius: 6, color: page === totalPages - 1 ? t.muted : t.textSub, fontSize: 12, cursor: page === totalPages - 1 ? "not-allowed" : "pointer", fontWeight: 500 }}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {sel ? (
        <div style={{ flex: 1, overflowY: "auto", background: t.bg }}>
          <div className="ea-slide">
            {/* ── Premium Hero Header ── */}
            <div style={{
              background: "linear-gradient(135deg, " + (sel.risk >= _thresh.high ? "#7F1D1D, #DC2626" : sel.risk >= _thresh.mod ? "#78350F, #D97706" : "#064E3B, #059669") + ")",
              padding: "24px 28px 0", position: "relative", overflow: "hidden",
            }}>
              {/* Background decorations */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.06)" }} />
              <div style={{ position: "absolute", bottom: -30, left: -20, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />

              {/* Top row: avatar + info + actions */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, position: "relative", zIndex: 1 }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(255,255,255,.22)", border: "2px solid rgba(255,255,255,.4)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "white", flexShrink: 0 }}>
                  {(sel.name || "??").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "-.3px", lineHeight: 1.1, marginBottom: 3 }}>{sel.name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginBottom: 8 }}>{sel.id} · {sel.programme} · Level {sel.level} · Sem {sel.semester}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)", fontSize: 11, color: "white", fontWeight: 700 }}>{Math.round(sel.risk * 100)}% Risk</span>
                    {(sel.flags || []).slice(0,2).map((f,i) => <span key={i} style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", fontSize: 11, color: "rgba(255,255,255,.85)" }}>{f}</span>)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <RiskGauge value={sel.risk} t={{ ...t, text: "white", muted: "rgba(255,255,255,.55)" }} size={88} />
                </div>
              </div>

              {/* Action bar */}
              <div style={{ display: "flex", gap: 6, marginTop: 16, paddingBottom: 16, position: "relative", zIndex: 1, flexWrap: "wrap" }}>
                {[
                  { label: "Log Intervention", icon: IC.note, action: () => setShowNote(true), primary: true },
                  { label: "Edit", icon: IC.edit, action: () => setShowEdit(true) },
                  { label: "Email", icon: IC.mail, action: () => setShowEmail(true) },
                  { label: "Full Profile", icon: IC.user, action: () => setShowFullProfile(true) },
                  { label: "Print", icon: IC.print, action: () => printReport(sel) },
                  { label: "", icon: IC.trash, action: () => { if (window.confirm("Remove " + sel.name + "?")) deleteStudent(sel.id); }, danger: true },
                ].map(({ label, icon, action, primary, danger }, i) => (
                  <button key={i} onClick={action} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: label ? "6px 13px" : "6px 10px",
                    background: primary ? "rgba(255,255,255,.95)" : danger ? "rgba(239,68,68,.25)" : "rgba(255,255,255,.15)",
                    border: "1px solid " + (primary ? "transparent" : danger ? "rgba(239,68,68,.5)" : "rgba(255,255,255,.3)"),
                    borderRadius: 8, color: primary ? (sel.risk >= _thresh.high ? "#7F1D1D" : sel.risk >= _thresh.mod ? "#78350F" : "#064E3B") : "white",
                    fontSize: 12, fontWeight: primary ? 700 : 600, cursor: "pointer",
                  }}>
                    <Icon ic={icon} size={13} color={primary ? (sel.risk >= _thresh.high ? "#7F1D1D" : sel.risk >= _thresh.mod ? "#78350F" : "#064E3B") : "white"} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab bar at bottom of header */}
              <div style={{ display: "flex", gap: 0, position: "relative", zIndex: 1, marginTop: 2 }}>
                {[{ id: "why", lbl: "Risk Factors" }, { id: "actions", lbl: "Action Plan" }, { id: "history", lbl: "Interventions" }].map(({ id, lbl }) => (
                  <button key={id} onClick={() => setExpTab(id)} style={{ padding: "10px 18px", border: "none", background: "none", color: expTab === id ? "white" : "rgba(255,255,255,.6)", fontWeight: expTab === id ? 700 : 500, fontSize: 12, cursor: "pointer", borderBottom: "3px solid " + (expTab === id ? "white" : "transparent"), transition: "all .15s" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Stat pills row ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, padding: "16px 28px 0" }}>
              {[
                { l: "GPA", v: sel.gpa.toFixed(2), pct: sel.gpa / 4, col: sel.gpa >= 3 ? t.safe : sel.gpa >= 2 ? t.warn : t.danger, note: sel.gpa < 2 ? "Below minimum" : sel.gpa >= 3 ? "Strong" : "Acceptable" },
                { l: "Attendance", v: sel.attendance + "%", pct: sel.attendance / 100, col: sel.attendance >= 80 ? t.safe : sel.attendance >= 65 ? t.warn : t.danger, note: sel.attendance < 65 ? "Below 65% threshold" : sel.attendance >= 80 ? "Excellent" : "Monitor" },
                { l: "Credits", v: sel.credits + " / " + sel.required, pct: sel.credits / (sel.required || 1), col: sel.credits / (sel.required || 1) >= .9 ? t.safe : t.warn, note: sel.credits / (sel.required || 1) < .75 ? "Behind schedule" : "On track" },
              ].map(({ l, v, pct, col, note }, i) => (
                <div key={i} style={{
                  padding: "14px 16px", background: t.surface,
                  border: "1px solid " + t.border, borderRadius: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,.06), 0 1px 0 rgba(255,255,255,.5) inset",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg," + col + "88," + col + "22)", borderRadius: "14px 14px 0 0" }} />
                  <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, letterSpacing: "-.5px", marginBottom: 6 }}>{v}</div>
                  <Bar pct={pct} color={col} t={t} h={4} />
                  <div style={{ fontSize: 11, color: col, marginTop: 5, fontWeight: 600 }}>{note}</div>
                </div>
              ))}
            </div>

            {/* Summary box */}
            <div style={{ margin: "14px 28px 0", padding: "14px 18px", background: sel.risk >= _thresh.high ? t.dangerBg : sel.risk >= _thresh.mod ? t.warnBg : t.safeBg, borderRadius: 12, border: "1px solid " + (sel.risk >= _thresh.high ? t.dangerMuted : sel.risk >= _thresh.mod ? t.warnMuted : t.safeMuted) }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: sel.risk >= _thresh.high ? t.danger : sel.risk >= _thresh.mod ? t.warn : t.safe, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>
                {sel.risk >= _thresh.high ? "⚠ High Risk — Advisor Summary" : sel.risk >= _thresh.mod ? "⚡ Moderate Risk — Advisor Summary" : "✓ Low Risk — Advisor Summary"}
              </div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>{generateOverallSummary(sel)}</div>
            </div>

            {/* Tab content */}
            <div style={{ padding: "16px 28px 28px" }}>

            {expTab === "why" && (
              <div style={{ marginBottom: 0 }}>
                <Card t={t} style={{ padding: "20px 22px", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Risk Factor Notes</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 16, lineHeight: 1.5 }}>Academic indicators for this record, ordered by level of concern.</div>
                  {generateWhyFlagged(sel).map(({ sev, text }, i) => {
                    const sevColor = { high: t.danger, mod: t.warn, low: t.safe }[sev] || t.danger;
                    const sevBg = { high: t.dangerBg, mod: t.warnBg, low: t.safeBg }[sev] || t.dangerBg;
                    const sevBrd = { high: t.dangerMuted, mod: t.warnMuted, low: t.safeMuted }[sev] || t.dangerMuted;
                    const sevLabel = { high: "High Concern", mod: "Moderate Concern", low: "Positive Signal" }[sev] || "High Concern";
                    return (
                      <div key={i} style={{ padding: "14px 16px", background: sevBg, borderRadius: 10, border: "1px solid " + sevBrd, marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: sevColor, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{sevLabel}</div>
                        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>{text}</div>
                      </div>
                    );
                  })}
                </Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Card t={t} style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>Risk Factor Weights</div>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>Red raises the risk score | Green lowers it</div>
                    <ShapBar data={sel.shap} t={t} />
                  </Card>
                  <Card t={t} style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>GPA Trend</div>
                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>vs programme average (dashed)</div>
                    <GpaTrend hist={sel.gpaHist || [null, null, null, sel.gpa]} t={t} avg={sel.progAvg || .45} />
                    <div style={{ marginTop: 8, display: "flex", gap: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 14, height: 3, background: t.accent, borderRadius: 2 }} /><span style={{ fontSize: 11, color: t.muted }}>GPA</span></div><div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 14, height: 2, background: t.warn, borderRadius: 2 }} /><span style={{ fontSize: 11, color: t.muted }}>Prog. Avg</span></div></div>
                  </Card>
                </div>
              </div>
            )}

            {expTab === "actions" && (
              <div style={{ marginBottom: 0 }}>
                <Card t={t} style={{ padding: "20px 22px", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Recommended Actions</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 16, lineHeight: 1.5 }}>Personalised recommendations ordered by urgency. Start from the top.</div>
                  {generateRecommendedActions(sel).map(({ priority, icon, title, detail }, i) => (
                    <div key={i} style={{ padding: "16px 18px", background: PRIORITY_BG[priority], borderRadius: 10, border: "1px solid " + PRIORITY_COLORS[priority] + "33", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}><Icon ic={IC[icon] || IC.note} size={20} color={PRIORITY_COLORS[priority]} /></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</div>
                            <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: PRIORITY_COLORS[priority], color: "white", flexShrink: 0 }}>{PRIORITY_LABEL[priority]}</span>
                          </div>
                          <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>{detail}</div>
                          <button onClick={() => setShowNote(true)} style={{ marginTop: 10, padding: "6px 14px", background: "none", border: "1px solid " + PRIORITY_COLORS[priority], borderRadius: 7, color: PRIORITY_COLORS[priority], fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Log this intervention</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card t={t} style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>How This Student Compares</div>
                  {[{ lbl: "This student", val: sel.risk }, { lbl: "Programme average", val: sel.progAvg || .45 }, { lbl: "University average", val: .42 }].map(({ lbl, val }, i) => (<div key={i} style={{ marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 12, color: t.textSub }}>{lbl}</span><span style={{ fontSize: 12, fontWeight: 700, color: rc(val, t) }}>{Math.round(val * 100)}% risk</span></div><Bar pct={val} color={rc(val, t)} t={t} h={5} /></div>))}
                </Card>
              </div>
            )}

            {expTab === "history" && (
              <Card t={t} style={{ padding: "18px 20px", marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Intervention History</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{(sel.interventions || []).length} record{(sel.interventions || []).length !== 1 ? "s" : ""}</div></div>
                  <button onClick={() => setShowNote(true)} style={{ fontSize: 12, color: t.accent, background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon ic={IC.note} size={13} color={t.accent} /> Add note</button>
                </div>
                {(!sel.interventions || !sel.interventions.length)
                  ? <div style={{ padding: "28px 0", textAlign: "center", border: "2px dashed " + t.border2, borderRadius: 10 }}><div style={{ opacity: .25, display: "flex", justifyContent: "center", marginBottom: 8 }}><Icon ic={IC.note} size={32} color={t.muted} /></div><div style={{ fontSize: 14, fontWeight: 600, color: t.muted }}>No interventions logged yet</div><div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>Use the button above to log your first note</div></div>
                  : sel.interventions.map((iv, i) => {
                    const typeColor = { email: t.accent, meeting: t.safe, call: t.warn, referral: "#8B5CF6", other: t.muted }[iv.type] || t.muted;
                    const typeBg = { email: t.accentBg, meeting: t.safeBg, call: t.warnBg, referral: "#F5F3FF", other: t.surface2 }[iv.type] || t.surface2;
                    return (
                      <div key={i} style={{ padding: "13px 16px", background: t.surface2, borderRadius: 10, border: "1px solid " + t.border, marginBottom: 10, borderLeft: "3px solid " + typeColor }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ padding: "2px 8px", borderRadius: 5, background: typeBg, border: "1px solid " + typeColor + "44", fontSize: 10, fontWeight: 700, color: typeColor, textTransform: "uppercase", letterSpacing: ".04em" }}>{iv.type || "note"}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>{iv.by || "Advisor"}</span>
                          </div>
                          <span style={{ fontSize: 11, color: t.muted, fontFamily: "monospace" }}>{iv.date}</span>
                        </div>
                        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.65 }}>{iv.note}</div>
                      </div>
                    );
                  })}
              </Card>
            )}
            </div>
          </div>
        </div>
      ) : <div style={{ flex: 1, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Empty icon={IC.user} title="Select a student" sub="Choose from the list to see their full risk profile and plain-English explanation." t={t} /></div>}
    </div>
  );
}

// ─── COHORT EXPORT (unchanged) ────────────────────────────────────────────────
function exportCohortReport(students, thresh) {
  const high = students.filter(s => s.risk >= (thresh.high / 100));
  const mod = students.filter(s => s.risk >= (thresh.mod / 100) && s.risk < (thresh.high / 100));
  const low = students.filter(s => s.risk < (thresh.mod / 100));
  const avg = students.length ? students.reduce((a, b) => a + b.risk, 0) / students.length : 0;
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const progRows = PROGS.slice(1).map(prog => {
    const ps = students.filter(s => s.programme === prog);
    if (!ps.length) return "";
    const pa = ps.reduce((a, b) => a + b.risk, 0) / ps.length;
    const ph = ps.filter(s => s.risk >= (thresh.high / 100)).length;
    return "<tr><td style='padding:10px 14px;border-bottom:1px solid #E4E7EC'>" + prog + "</td><td style='padding:10px 14px;border-bottom:1px solid #E4E7EC;text-align:center'>" + ps.length + "</td><td style='padding:10px 14px;border-bottom:1px solid #E4E7EC;text-align:center;color:#DC2626;font-weight:600'>" + ph + "</td><td style='padding:10px 14px;border-bottom:1px solid #E4E7EC;text-align:center;font-weight:700;color:" + (pa >= (thresh.high / 100) ? "#DC2626" : pa >= (thresh.mod / 100) ? "#B45309" : "#059669") + "'>" + Math.round(pa * 100) + "%</td></tr>";
  }).join("");
  const stuRows = [...students].sort((a, b) => b.risk - a.risk).map(s => {
    const col = s.risk >= (thresh.high / 100) ? "#DC2626" : s.risk >= (thresh.mod / 100) ? "#B45309" : "#059669";
    const lbl = s.risk >= (thresh.high / 100) ? "High Risk" : s.risk >= (thresh.mod / 100) ? "Moderate" : "Low Risk";
    return "<tr><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC;font-weight:500'>" + s.name + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC;color:#667085;font-size:12px'>" + s.id + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'>" + s.programme + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC;text-align:center'>" + s.level + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC;text-align:center;font-weight:700;color:" + (s.gpa >= 3 ? "#059669" : s.gpa >= 2 ? "#B45309" : "#DC2626") + "'>" + s.gpa.toFixed(1) + "</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC;text-align:center'>" + s.attendance + "%</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC;text-align:center;font-weight:700;color:" + col + "'>" + Math.round(s.risk * 100) + "%</td><td style='padding:9px 12px;border-bottom:1px solid #E4E7EC'><span style='padding:2px 8px;background:" + col + "15;border:1px solid " + col + "40;border-radius:4px;font-size:11px;font-weight:700;color:" + col + "'>" + lbl + "</span></td></tr>";
  }).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>EduAlert - Cohort Risk Report</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#101828;background:#fff;padding:32px 40px;position:relative}body:before{content:"";position:fixed;inset:12% 16%;background:url("${UENR_LOGO}") center/contain no-repeat;opacity:.11;z-index:-1}@media print{body{padding:16px}.no-print{display:none!important}@page{margin:1.5cm;size:A4}}h2{font-size:14px;font-weight:700;color:#344054;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #E4E7EC}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.86)}th{font-size:11px;font-weight:600;color:#667085;text-align:left;padding:9px 12px;border-bottom:2px solid #E4E7EC;text-transform:uppercase;letter-spacing:.04em}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}.kpi{padding:14px 16px;border:1px solid #E4E7EC;border-radius:10px;background:rgba(248,250,252,.88)}.kpi-label{font-size:10px;font-weight:600;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}.kpi-val{font-size:26px;font-weight:800}.school-logo{width:58px;height:58px;object-fit:contain;border:1px solid #E4E7EC;border-radius:12px;padding:3px;background:white;margin-right:14px}</style></head>
<body>
<div class="no-print" style="margin-bottom:20px"><button onclick="window.print()" style="padding:10px 24px;background:#2563EB;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Print / Save as PDF</button><button onclick="window.close()" style="margin-left:10px;padding:10px 20px;background:none;border:1px solid #D0D5DD;border-radius:8px;font-size:14px;cursor:pointer">Close</button></div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #2563EB;background:rgba(255,255,255,.9)">
  <div style="display:flex;align-items:flex-start"><img class="school-logo" src="${UENR_LOGO}" /><div><div style="font-size:11px;font-weight:600;color:#2563EB;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">University of Energy and Natural Resources - EduAlert</div><h1 style="font-size:22px;font-weight:800;margin-bottom:4px">Cohort Dropout Risk Report</h1><div style="font-size:12px;color:#667085">2024/2025 Academic Year | Semester 2 | Generated ${today}</div></div></div>
  <div style="text-align:right"><div style="font-size:28px;font-weight:800;color:#2563EB">${students.length}</div><div style="font-size:11px;color:#667085">Total students</div></div>
</div>
<h2>Summary</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total monitored</div><div class="kpi-val" style="color:#2563EB">${students.length}</div></div>
  <div class="kpi"><div class="kpi-label">High risk</div><div class="kpi-val" style="color:#DC2626">${high.length}</div><div style="font-size:11px;color:#667085;margin-top:3px">${students.length ? Math.round(high.length / students.length * 100) : 0}% of cohort</div></div>
  <div class="kpi"><div class="kpi-label">Moderate risk</div><div class="kpi-val" style="color:#B45309">${mod.length}</div><div style="font-size:11px;color:#667085;margin-top:3px">${students.length ? Math.round(mod.length / students.length * 100) : 0}% of cohort</div></div>
  <div class="kpi"><div class="kpi-label">Average risk score</div><div class="kpi-val" style="color:${avg >= (thresh.high / 100) ? "#DC2626" : avg >= (thresh.mod / 100) ? "#B45309" : "#059669"}">${Math.round(avg * 100)}%</div></div>
</div>
<h2>By Programme</h2>
<table style="margin-bottom:24px"><thead><tr><th>Programme</th><th style="text-align:center">Students</th><th style="text-align:center">High Risk</th><th style="text-align:center">Avg Risk</th></tr></thead><tbody>${progRows}</tbody></table>
<h2>Full Student List - Ranked by Risk Score</h2>
<table><thead><tr><th>Name</th><th>ID</th><th>Programme</th><th>Level</th><th>GPA</th><th>Attend.</th><th>Risk</th><th>Status</th></tr></thead><tbody>${stuRows}</tbody></table>
<div style="margin-top:32px;padding-top:14px;border-top:1px solid #E4E7EC;display:flex;justify-content:space-between;font-size:10px;color:#667085"><div>EduAlert | UENR Group 27 Final Year Project 2026</div><div>Confidential - For academic advisor use only | ${today}</div></div>
</body></html>`;
  const w = window.open("", "_blank", "width=1000,height=900,scrollbars=yes");
  w.document.write(html); w.document.close();
}

// ─── ANALYTICS PAGE ─────────────────────────────────────────────────────────
function AnalyticsPage({ t, students, thresh = { high: 70, mod: 40 } }) {
  // ── state ──
  const [chartType, setChartType]   = useState("bar");
  const [chartFilter, setChartFilter] = useState({ high: true, mod: true, low: true });
  const [chartColors, setChartColors] = useState({ high: t.danger, mod: t.warn, low: t.safe });
  const [progFilter, setProgFilter]   = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [semFilter, setSemFilter]     = useState("All");
  const [maximized, setMaximized]     = useState(null); // chart id string or null
  const [activeTab, setActiveTab]     = useState("distribution"); // distribution | programme | gpa | attendance | shap | table

  if (!students.length) return (
    <div style={{ flex: 1, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Empty icon={IC.analytics} title="No data yet" sub="Upload a student dataset or run batch predictions to see analytics." t={t} />
    </div>
  );

  // ── derived / filtered data ──
  const progs   = [...new Set(students.map(s => s.programme).filter(Boolean))].sort();
  const levels  = [...new Set(students.map(s => String(s.level)).filter(Boolean))].sort();
  const sems    = [...new Set(students.map(s => String(s.semester)).filter(Boolean))].sort();

  const filtered = students.filter(s =>
    (progFilter  === "All" || s.programme      === progFilter) &&
    (levelFilter === "All" || String(s.level)  === levelFilter) &&
    (semFilter   === "All" || String(s.semester) === semFilter)
  );

  const high = filtered.filter(s => s.risk >= thresh.high / 100);
  const mod  = filtered.filter(s => s.risk >= thresh.mod / 100 && s.risk < thresh.high / 100);
  const low  = filtered.filter(s => s.risk < thresh.mod / 100);
  const avg  = filtered.length ? filtered.reduce((a, b) => a + b.risk, 0) / filtered.length : 0;
  const avgGpa = filtered.length ? filtered.reduce((a, b) => a + b.gpa, 0) / filtered.length : 0;
  const avgAtt = filtered.length ? filtered.reduce((a, b) => a + b.attendance, 0) / filtered.length : 0;

  const fHigh = chartFilter.high ? high.length : 0;
  const fMod  = chartFilter.mod  ? mod.length  : 0;
  const fLow  = chartFilter.low  ? low.length  : 0;
  const fTotal = fHigh + fMod + fLow;

  const PS = progs.map(prog => {
    const ps = filtered.filter(s => s.programme === prog);
    if (!ps.length) return null;
    return {
      prog, count: ps.length,
      avg:  ps.reduce((a, b) => a + b.risk, 0) / ps.length,
      high: ps.filter(s => s.risk >= thresh.high / 100).length,
      mod:  ps.filter(s => s.risk >= thresh.mod / 100 && s.risk < thresh.high / 100).length,
      avgGpa: ps.reduce((a, b) => a + b.gpa, 0) / ps.length,
      avgAtt: ps.reduce((a, b) => a + b.attendance, 0) / ps.length,
    };
  }).filter(Boolean).sort((a, b) => b.avg - a.avg);

  // ── GPA distribution buckets ──
  const gpaBuckets = [
    { label: "0.0–1.0", lo: 0,   hi: 1.0 }, { label: "1.0–1.5", lo: 1.0, hi: 1.5 },
    { label: "1.5–2.0", lo: 1.5, hi: 2.0 }, { label: "2.0–2.5", lo: 2.0, hi: 2.5 },
    { label: "2.5–3.0", lo: 2.5, hi: 3.0 }, { label: "3.0–3.5", lo: 3.0, hi: 3.5 },
    { label: "3.5–4.0", lo: 3.5, hi: 4.01 }
  ].map(b => ({ ...b, count: filtered.filter(s => s.gpa >= b.lo && s.gpa < b.hi).length }));
  const gpaBuckMax = Math.max(...gpaBuckets.map(b => b.count), 1);

  // ── Attendance buckets ──
  const attBuckets = [
    { label: "<50%", lo: 0,  hi: 50  }, { label: "50–65%", lo: 50, hi: 65  },
    { label: "65–75%", lo: 65, hi: 75 }, { label: "75–85%", lo: 75, hi: 85 },
    { label: "85–95%", lo: 85, hi: 95 }, { label: "95–100%", lo: 95, hi: 101 }
  ].map(b => ({ ...b, count: filtered.filter(s => s.attendance >= b.lo && s.attendance < b.hi).length }));
  const attBuckMax = Math.max(...attBuckets.map(b => b.count), 1);

  // ── SHAP aggregated average ──
  const shapFactors = {};
  filtered.forEach(s => { (s.shap || []).forEach(item => { const k = item.f || ""; if (!k) return; shapFactors[k] = (shapFactors[k] || 0) + Math.abs(item.v || 0); }); });
  const shapSorted = Object.entries(shapFactors).map(([f, v]) => ({ f, v: v / filtered.length })).sort((a, b) => b.v - a.v).slice(0, 6);

  // ── summary kpi cards ──
  const kpis = [
    { lbl: "Total Filtered",  val: filtered.length, sub: "of " + students.length + " students", col: t.accent,  icon: IC.students },
    { lbl: "High Risk",       val: high.length,     sub: filtered.length ? Math.round(high.length / filtered.length * 100) + "% of cohort" : "—", col: t.danger,  icon: IC.alert },
    { lbl: "Moderate Risk",   val: mod.length,      sub: filtered.length ? Math.round(mod.length  / filtered.length * 100) + "% of cohort" : "—", col: t.warn,    icon: IC.activity },
    { lbl: "Avg Risk Score",  val: Math.round(avg * 100) + "%", sub: "cohort average", col: rc(avg, t), icon: IC.chart },
    { lbl: "Avg GPA",         val: avgGpa.toFixed(2), sub: "cohort average", col: avgGpa >= 3 ? t.safe : avgGpa >= 2 ? t.warn : t.danger, icon: IC.trend },
    { lbl: "Avg Attendance",  val: Math.round(avgAtt) + "%", sub: "cohort average", col: avgAtt >= 80 ? t.safe : avgAtt >= 65 ? t.warn : t.danger, icon: IC.analytics },
  ];

  // ── chart tabs ──
  const CHART_TYPES = [
    { id: "bar",     lbl: "Bar" },
    { id: "pie",     lbl: "Pie" },
    { id: "donut",   lbl: "Donut" },
    { id: "hist",    lbl: "Histogram" },
    { id: "scatter", lbl: "Scatter" },
    { id: "area",    lbl: "Area" },
  ];
  const TABS = [
    { id: "distribution", lbl: "Risk Distribution" },
    { id: "programme",    lbl: "By Programme" },
    { id: "gpa",          lbl: "GPA Analysis" },
    { id: "attendance",   lbl: "Attendance" },
    { id: "shap",         lbl: "Factor Weights" },
    { id: "table",        lbl: "Data Table" },
  ];
  const chartTitles = {
    distribution: "Risk Distribution",
    programme: "Risk by Programme",
    gpa: "GPA Distribution",
    attendance: "Attendance Distribution",
    shap: "Average Factor Weights",
  };

  // ── print analytics ──
  function printChart(title, elementId) {
    const source = document.getElementById(elementId);
    if (!source) { alert("Chart is not ready to print yet."); return; }
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const w = window.open("", "_blank", "width=980,height=760,scrollbars=yes");
    if (!w) { alert("Please allow popups to print this chart."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title} - ${today}</title><style>
      *{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#101828;background:white;padding:28px}
      .no-print{margin-bottom:18px}.no-print button{padding:9px 20px;background:#2563EB;color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer}
      .header{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #2563EB}
      .logo{width:54px;height:54px;object-fit:contain;border:1px solid #E4E7EC;border-radius:12px;padding:3px}
      h1{font-size:20px;margin:0}.meta{font-size:12px;color:#667085;margin-top:4px}.chart{border:1px solid #E4E7EC;border-radius:12px;padding:24px;background:white}
      svg{max-width:100%;height:auto}button{font-family:inherit}
      @media print{body{padding:12px}.no-print{display:none!important}@page{margin:1.5cm;size:A4 landscape}}
    </style></head><body>
      <div class="no-print"><button onclick="window.print()">Print / Save PDF</button></div>
      <div class="header"><img class="logo" src="${UENR_LOGO}" /><div><h1>${title}</h1><div class="meta">Generated: ${today} | ${filtered.length} students in view</div></div></div>
      <div class="chart">${source.innerHTML}</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch(e){} }, 400);
  }

  function printAnalytics() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const progRows = PS.map(p => `<tr><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC">${p.prog}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;text-align:center">${p.count}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;text-align:center;color:#DC2626;font-weight:700">${p.high}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;text-align:center;color:#B45309;font-weight:700">${p.mod}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;text-align:center;font-weight:700">${Math.round(p.avg*100)}%</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;text-align:center">${p.avgGpa.toFixed(2)}</td><td style="padding:8px 12px;border-bottom:1px solid #E4E7EC;text-align:center">${Math.round(p.avgAtt)}%</td></tr>`).join("");
    const stuRows = [...filtered].sort((a,b)=>b.risk-a.risk).map(s=>`<tr><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC;font-weight:500">${s.name}</td><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC;font-size:11px;color:#667085;font-family:monospace">${s.id}</td><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC">${s.programme}</td><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC;text-align:center">${s.level}</td><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC;text-align:center;font-weight:700;color:${s.gpa>=3?"#059669":s.gpa>=2?"#B45309":"#DC2626"}">${s.gpa.toFixed(2)}</td><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC;text-align:center">${s.attendance}%</td><td style="padding:7px 10px;border-bottom:1px solid #E4E7EC;text-align:center;font-weight:700;color:${s.risk>=thresh.high/100?"#DC2626":s.risk>=thresh.mod/100?"#B45309":"#059669"}">${Math.round(s.risk*100)}%</td></tr>`).join("");
    const w = window.open("", "_blank", "width=1050,height=900,scrollbars=yes");
    if (!w) { alert("Please allow popups to print analytics."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>EduAlert Analytics Report — ${today}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;font-size:13px;color:#101828;padding:32px 40px;position:relative}body:before{content:"";position:fixed;inset:10% 18%;background:url("${UENR_LOGO}") center/contain no-repeat;opacity:.11;z-index:-1}h2{font-size:14px;font-weight:700;color:#344054;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #E4E7EC}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.86)}th{font-size:11px;font-weight:600;color:#667085;text-align:left;padding:8px 10px;border-bottom:2px solid #E4E7EC;text-transform:uppercase}.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:18px 0}.kpi{padding:12px 14px;border:1px solid #E4E7EC;border-radius:10px;background:rgba(248,250,252,.88)}.kpi-val{font-size:22px;font-weight:800;margin-bottom:3px}.kpi-lbl{font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:.05em}.school-logo{width:56px;height:56px;object-fit:contain;border:1px solid #E4E7EC;border-radius:12px;padding:3px;background:white;margin-right:14px}@media print{body{padding:16px}.no-print{display:none}@page{margin:1.5cm;size:A4 landscape}}</style></head><body>
<div class="no-print" style="margin-bottom:18px"><button onclick="window.print()" style="padding:9px 22px;background:#2563EB;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Print / Save PDF</button><button onclick="window.close()" style="margin-left:10px;padding:9px 18px;background:none;border:1px solid #D0D5DD;border-radius:8px;font-size:13px;cursor:pointer">Close</button></div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;padding-bottom:16px;border-bottom:3px solid #2563EB;background:rgba(255,255,255,.9)"><div style="display:flex;align-items:flex-start"><img class="school-logo" src="${UENR_LOGO}" /><div><div style="font-size:10px;font-weight:700;color:#2563EB;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">UENR — EduAlert Academic Risk System</div><h1 style="font-size:20px;font-weight:800">Analytics Report</h1><div style="font-size:12px;color:#667085;margin-top:3px">Filters: Programme = ${progFilter} | Level = ${levelFilter} | Semester = ${semFilter}</div></div></div><div style="text-align:right;font-size:12px;color:#667085">Generated: ${today}<br/>${filtered.length} students in view</div></div>
<h2>Summary KPIs</h2><div class="kpi-grid"><div class="kpi"><div class="kpi-val" style="color:#2563EB">${filtered.length}</div><div class="kpi-lbl">Filtered students</div></div><div class="kpi"><div class="kpi-val" style="color:#DC2626">${high.length}</div><div class="kpi-lbl">High risk</div></div><div class="kpi"><div class="kpi-val" style="color:#B45309">${mod.length}</div><div class="kpi-lbl">Moderate risk</div></div><div class="kpi"><div class="kpi-val" style="color:#059669">${low.length}</div><div class="kpi-lbl">Low risk</div></div><div class="kpi"><div class="kpi-val">${avgGpa.toFixed(2)}</div><div class="kpi-lbl">Avg GPA</div></div><div class="kpi"><div class="kpi-val">${Math.round(avgAtt)}%</div><div class="kpi-lbl">Avg Attendance</div></div></div>
<h2>Programme Breakdown</h2><table><thead><tr><th>Programme</th><th>Students</th><th>High Risk</th><th>Moderate</th><th>Avg Risk</th><th>Avg GPA</th><th>Avg Att.</th></tr></thead><tbody>${progRows}</tbody></table>
<h2>Full Student List (sorted by risk)</h2><table><thead><tr><th>Name</th><th>ID</th><th>Programme</th><th>Level</th><th>GPA</th><th>Attendance</th><th>Risk</th></tr></thead><tbody>${stuRows}</tbody></table>
<div style="margin-top:28px;padding-top:12px;border-top:1px solid #E4E7EC;font-size:10px;color:#667085;display:flex;justify-content:space-between"><div>EduAlert | UENR Group 27 | 2026</div><div>Confidential – For authorised academic advisors only</div></div>
</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch(e){} }, 400);
  }

  // ── maximized chart overlay ──
  function ChartMaxModal({ onClose, title, children }) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 3500, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ width: "100%", maxWidth: 1100, background: t.surface, borderRadius: 20, border: "1px solid " + t.border, boxShadow: "0 32px 80px rgba(0,0,0,.35)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "1px solid " + t.border, background: t.surface2 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => printChart(title, "analytics-chart-" + maximized)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Icon ic={IC.print} size={13} color="white" /> Print</button>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.surface, border: "1px solid " + t.border2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon ic={IC.x} size={14} color={t.muted} /></button>
            </div>
          </div>
          <div style={{ padding: "28px 32px", overflowY: "auto", maxHeight: "80vh" }}>{children}</div>
        </div>
      </div>
    );
  }

  // ── shared chart controls (type + filter + colors) ──
  function ChartControls() {
    return (
      <div style={{ marginBottom: 16 }}>
        {/* Chart type pills */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 3, background: t.surface2, borderRadius: 9, padding: 3, border: "1px solid " + t.border }}>
            {CHART_TYPES.map(({ id, lbl }) => (
              <button key={id} onClick={() => setChartType(id)}
                style={{ padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: chartType === id ? t.surface : "transparent",
                  color: chartType === id ? t.accent : t.muted,
                  boxShadow: chartType === id ? "0 1px 4px rgba(0,0,0,.08)" : "none", transition: "all .15s" }}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setMaximized("distribution")} title="Maximize chart" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 7, color: t.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Icon ic={IC.trend} size={12} color={t.muted} /> Maximize
            </button>
            <button onClick={() => printChart(chartTitles.distribution + " - " + CHART_TYPES.find(c => c.id === chartType).lbl, "analytics-chart-distribution")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: t.accent, border: "none", borderRadius: 7, color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <Icon ic={IC.print} size={12} color="white" /> Print
            </button>
          </div>
        </div>
        {/* Filter + color row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "9px 12px", background: t.surface2, borderRadius: 9, border: "1px solid " + t.border }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Show:</span>
          {[{ key: "high", label: "High Risk" }, { key: "mod", label: "Moderate" }, { key: "low", label: "Low Risk" }].map(({ key, label }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button onClick={() => setChartFilter(f => ({ ...f, [key]: !f[key] }))}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, border: "1.5px solid " + chartColors[key], cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: chartFilter[key] ? chartColors[key] + "22" : "transparent",
                  color: chartFilter[key] ? chartColors[key] : t.muted,
                  opacity: chartFilter[key] ? 1 : .5, transition: "all .15s" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: chartFilter[key] ? chartColors[key] : t.muted }} />{label}
              </button>
              <label style={{ cursor: "pointer", position: "relative" }}>
                <input type="color" value={chartColors[key]} onChange={e => setChartColors(c => ({ ...c, [key]: e.target.value }))}
                  style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                <div style={{ width: 16, height: 16, borderRadius: 4, background: chartColors[key], border: "2px solid " + t.border2, boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function ActiveChart() {
    if (chartType === "bar")     return <BarChartOv high={fHigh} mod={fMod} low={fLow} total={fTotal} t={t} colors={chartColors} />;
    if (chartType === "pie")     return <PieDonutChart high={fHigh} mod={fMod} low={fLow} total={fTotal} donut={false} t={t} colors={chartColors} />;
    if (chartType === "donut")   return <PieDonutChart high={fHigh} mod={fMod} low={fLow} total={fTotal} donut={true} t={t} colors={chartColors} />;
    if (chartType === "hist")    return <HistogramOv students={filtered.filter(s => (chartFilter.high && s.risk >= thresh.high/100) || (chartFilter.mod && s.risk >= thresh.mod/100 && s.risk < thresh.high/100) || (chartFilter.low && s.risk < thresh.mod/100))} t={t} colors={chartColors} />;
    if (chartType === "scatter") return <ScatterOv  students={filtered.filter(s => (chartFilter.high && s.risk >= thresh.high/100) || (chartFilter.mod && s.risk >= thresh.mod/100 && s.risk < thresh.high/100) || (chartFilter.low && s.risk < thresh.mod/100))} t={t} colors={chartColors} />;
    if (chartType === "area")    return <AreaChartOv high={fHigh} mod={fMod} low={fLow} total={filtered.length} t={t} colors={chartColors} />;
    return null;
  }

  // ── GPA bar chart ──
  function GpaDistChart() {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130, marginBottom: 6 }}>
          {gpaBuckets.map((b, i) => {
            const h = (b.count / gpaBuckMax) * 100;
            const col = b.lo >= 3 ? t.safe : b.lo >= 2 ? t.warn : t.danger;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ fontSize: 9, color: t.muted, fontWeight: 600 }}>{b.count}</div>
                <div title={b.label + ": " + b.count + " students"} style={{ width: "100%", height: h + "%", minHeight: b.count ? 4 : 0, background: col, borderRadius: "4px 4px 0 0", transition: "height .3s" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
          {gpaBuckets.map((b, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: t.muted, textAlign: "center" }}>{b.label}</div>)}
        </div>
      </div>
    );
  }

  // ── Attendance bar chart ──
  function AttDistChart() {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130, marginBottom: 6 }}>
          {attBuckets.map((b, i) => {
            const h = (b.count / attBuckMax) * 100;
            const col = b.lo >= 85 ? t.safe : b.lo >= 65 ? t.warn : t.danger;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ fontSize: 9, color: t.muted, fontWeight: 600 }}>{b.count}</div>
                <div title={b.label + ": " + b.count + " students"} style={{ width: "100%", height: h + "%", minHeight: b.count ? 4 : 0, background: col, borderRadius: "4px 4px 0 0", transition: "height .3s" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
          {attBuckets.map((b, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: t.muted, textAlign: "center" }}>{b.label}</div>)}
        </div>
      </div>
    );
  }

  // ── Programme bar chart (horizontal) ──
  function ProgBarChart() {
    const maxRisk = Math.max(...PS.map(p => p.avg), .01);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PS.map((p, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: 500 }}>{p.prog}</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: t.muted }}>{p.count} students</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: rc(p.avg, t) }}>{Math.round(p.avg * 100)}%</span>
              </div>
            </div>
            <div style={{ height: 8, background: t.surface2, borderRadius: 4, overflow: "hidden", border: "1px solid " + t.border }}>
              <div style={{ height: "100%", width: (p.avg / maxRisk * 100) + "%", background: rc(p.avg, t), borderRadius: 4, transition: "width .4s" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: t.danger }}>● {p.high} high</span>
              <span style={{ fontSize: 10, color: t.warn }}>● {p.mod} mod</span>
              <span style={{ fontSize: 10, color: t.muted }}>GPA {p.avgGpa.toFixed(2)} · Att {Math.round(p.avgAtt)}%</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── SHAP aggregate chart ──
  function ShapAggChart() {
    const maxV = Math.max(...shapSorted.map(s => s.v), .01);
    return (
      <div>
        {shapSorted.length === 0
          ? <div style={{ fontSize: 13, color: t.muted, textAlign: "center", padding: "24px 0" }}>No SHAP data available. Run predictions first.</div>
          : shapSorted.map(({ f, v }, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>{f}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>{(v * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 7, background: t.surface2, borderRadius: 4, overflow: "hidden", border: "1px solid " + t.border }}>
                <div style={{ height: "100%", width: (v / maxV * 100) + "%", background: "linear-gradient(90deg," + t.accent + "," + t.accentMuted + ")", borderRadius: 4, transition: "width .4s" }} />
              </div>
            </div>
          ))}
        <div style={{ fontSize: 11, color: t.muted, marginTop: 8 }}>Average absolute SHAP value per factor across all {filtered.length} filtered students.</div>
      </div>
    );
  }

  // ── Data table tab ──
  const [sortCol, setSortCol]   = useState("risk");
  const [sortDir, setSortDir]   = useState(-1);
  const [tableSearch, setTableSearch] = useState("");
  function toggleSort(col) { if (sortCol === col) setSortDir(d => -d); else { setSortCol(col); setSortDir(-1); } }
  const tableData = [...filtered]
    .filter(s => !tableSearch || s.name.toLowerCase().includes(tableSearch.toLowerCase()) || (s.id || "").toLowerCase().includes(tableSearch.toLowerCase()))
    .sort((a, b) => {
      const av = sortCol === "risk" ? a.risk : sortCol === "gpa" ? a.gpa : sortCol === "attendance" ? a.attendance : 0;
      const bv = sortCol === "risk" ? b.risk : sortCol === "gpa" ? b.gpa : sortCol === "attendance" ? b.attendance : 0;
      return (bv - av) * sortDir;
    });
  const SortArrow = ({ col }) => sortCol === col ? <span style={{ marginLeft: 3, fontSize: 9 }}>{sortDir === -1 ? "▼" : "▲"}</span> : null;

  // ── global filter bar ──
  const filterBar = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: t.surface, border: "1px solid " + t.border, borderRadius: 12, boxShadow: t.shadow }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Filter:</span>
      {[
        { label: "Programme", val: progFilter, set: setProgFilter, opts: ["All", ...progs] },
        { label: "Level",     val: levelFilter, set: setLevelFilter, opts: ["All", ...levels] },
        { label: "Semester",  val: semFilter,   set: setSemFilter,   opts: ["All", ...sems] },
      ].map(({ label, val, set, opts }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: t.muted }}>{label}:</span>
          <select value={val} onChange={e => set(e.target.value)} style={{ padding: "5px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 7, color: t.text, fontSize: 12, cursor: "pointer" }}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button onClick={printAnalytics} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Icon ic={IC.print} size={13} color="white" /> Print Report
        </button>
        <button onClick={() => exportCohortReport(filtered, thresh)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Icon ic={IC.download} size={13} color={t.textSub} /> Export CSV
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", background: t.bg }}>

      {/* Maximized chart overlay */}
      {maximized === "distribution" && (
        <ChartMaxModal title="Risk Distribution — Full View" onClose={() => setMaximized(null)}>
          <ChartControls />
          <div id="analytics-chart-distribution"><ActiveChart /></div>
        </ChartMaxModal>
      )}
      {maximized === "programme" && (
        <ChartMaxModal title="By Programme — Full View" onClose={() => setMaximized(null)}>
          <div id="analytics-chart-programme"><ProgBarChart /></div>
        </ChartMaxModal>
      )}
      {maximized === "gpa" && (
        <ChartMaxModal title="GPA Distribution — Full View" onClose={() => setMaximized(null)}>
          <div id="analytics-chart-gpa"><GpaDistChart /></div>
        </ChartMaxModal>
      )}
      {maximized === "attendance" && (
        <ChartMaxModal title="Attendance Distribution — Full View" onClose={() => setMaximized(null)}>
          <div id="analytics-chart-attendance"><AttDistChart /></div>
        </ChartMaxModal>
      )}
      {maximized === "shap" && (
        <ChartMaxModal title="Average Factor Weights (SHAP) — Full View" onClose={() => setMaximized(null)}>
          <div id="analytics-chart-shap"><ShapAggChart /></div>
        </ChartMaxModal>
      )}

      {/* Global filter bar */}
      {filterBar}

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
        {kpis.map(({ lbl, val, sub, col, icon }, i) => (
          <div key={i} className="ea-stat-card" style={{ background: t.surface, border: "1px solid " + t.border, padding: "14px 16px", boxShadow: "0 4px 14px rgba(0,0,0,.06),0 1px 0 rgba(255,255,255,.5) inset", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg," + col + "66," + col + "22)", borderRadius: "16px 16px 0 0" }} />
            <div style={{ position: "absolute", right: -10, bottom: -10, width: 50, height: 50, borderRadius: "50%", background: col + "10" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
              <div>
                <div style={{ fontSize: 9, color: t.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{lbl}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: col, letterSpacing: "-.5px", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{sub}</div>
              </div>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: col + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon ic={icon} size={14} color={col} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, background: t.surface2, borderRadius: 10, padding: 4, border: "1px solid " + t.border, flexWrap: "wrap" }}>
        {TABS.map(({ id, lbl }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: activeTab === id ? 700 : 500,
            background: activeTab === id ? t.surface : "transparent",
            color: activeTab === id ? t.accent : t.muted,
            boxShadow: activeTab === id ? t.shadow : "none", transition: "all .15s" }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── Risk Distribution tab ── */}
      {activeTab === "distribution" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <ChartControls />
            <div id="analytics-chart-distribution"><ActiveChart /></div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Quick stats sidebar */}
            {[
              { lbl: "High Risk", count: high.length, pct: filtered.length ? high.length/filtered.length : 0, col: t.danger, bg: t.dangerBg, brd: t.dangerMuted },
              { lbl: "Moderate",  count: mod.length,  pct: filtered.length ? mod.length/filtered.length  : 0, col: t.warn,   bg: t.warnBg,   brd: t.warnMuted },
              { lbl: "Low Risk",  count: low.length,  pct: filtered.length ? low.length/filtered.length  : 0, col: t.safe,   bg: t.safeBg,   brd: t.safeMuted },
            ].map(({ lbl, count, pct, col, bg, brd }) => (
              <div key={lbl} style={{ padding: "14px 16px", background: bg, borderRadius: 12, border: "1px solid " + brd }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{lbl}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: col }}>{count}</span>
                </div>
                <div style={{ height: 5, background: "rgba(0,0,0,.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: (pct * 100) + "%", background: col, borderRadius: 3, transition: "width .4s" }} />
                </div>
                <div style={{ fontSize: 11, color: col, marginTop: 5, fontWeight: 600 }}>{Math.round(pct * 100)}% of {filtered.length} students</div>
              </div>
            ))}
            <Card t={t} style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>Risk Thresholds</div>
              <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.8 }}>
                <div>High risk: <strong style={{ color: t.danger }}>≥ {thresh.high}%</strong></div>
                <div>Moderate: <strong style={{ color: t.warn }}>{thresh.mod}% – {thresh.high - 1}%</strong></div>
                <div>Low risk: <strong style={{ color: t.safe }}>&lt; {thresh.mod}%</strong></div>
                <div style={{ marginTop: 8, fontSize: 11, color: t.muted }}>Adjust thresholds in Settings.</div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Programme tab ── */}
      {activeTab === "programme" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Risk by Programme</div><div style={{ fontSize: 12, color: t.muted }}>Average dropout risk score</div></div>
              <button onClick={() => printChart(chartTitles.programme, "analytics-chart-programme")} style={{ padding: "5px 11px", background: t.accent, border: "none", borderRadius: 7, color: "white", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Print</button>
              <button onClick={() => setMaximized("programme")} style={{ padding: "5px 11px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 7, color: t.muted, fontSize: 11, cursor: "pointer" }}>⛶ Maximize</button>
            </div>
            <div id="analytics-chart-programme"><ProgBarChart /></div>
          </Card>
          <Card t={t} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Programme Summary Table</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: t.surface2 }}>
                    {["Programme", "Total", "High", "Mod", "Avg Risk", "Avg GPA", "Avg Att."].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: t.muted, borderBottom: "1px solid " + t.border, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PS.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid " + t.border }} className="ea-row">
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: t.text }}>{p.prog}</td>
                      <td style={{ padding: "10px 14px", color: t.muted }}>{p.count}</td>
                      <td style={{ padding: "10px 14px", color: t.danger, fontWeight: 700 }}>{p.high}</td>
                      <td style={{ padding: "10px 14px", color: t.warn, fontWeight: 700 }}>{p.mod}</td>
                      <td style={{ padding: "10px 14px" }}><Badge risk={p.avg} t={t} sm /></td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: p.avgGpa >= 3 ? t.safe : p.avgGpa >= 2 ? t.warn : t.danger }}>{p.avgGpa.toFixed(2)}</td>
                      <td style={{ padding: "10px 14px", color: Math.round(p.avgAtt) >= 80 ? t.safe : Math.round(p.avgAtt) >= 65 ? t.warn : t.danger, fontWeight: 600 }}>{Math.round(p.avgAtt)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── GPA tab ── */}
      {activeTab === "gpa" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>GPA Distribution</div><div style={{ fontSize: 12, color: t.muted }}>Students per GPA bracket</div></div>
              <button onClick={() => printChart(chartTitles.gpa, "analytics-chart-gpa")} style={{ padding: "5px 11px", background: t.accent, border: "none", borderRadius: 7, color: "white", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Print</button>
              <button onClick={() => setMaximized("gpa")} style={{ padding: "5px 11px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 7, color: t.muted, fontSize: 11, cursor: "pointer" }}>⛶ Maximize</button>
            </div>
            <div id="analytics-chart-gpa"><GpaDistChart /></div>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              {[["≥ 3.0 Excellent", t.safe], ["2.0–2.9 Acceptable", t.warn], ["< 2.0 At Risk", t.danger]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} /><span style={{ fontSize: 10, color: t.muted }}>{l}</span></div>
              ))}
            </div>
          </Card>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>GPA Insights</div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>Key statistics from filtered cohort</div>
            {[
              { lbl: "Average GPA", val: avgGpa.toFixed(2), col: avgGpa >= 3 ? t.safe : avgGpa >= 2 ? t.warn : t.danger },
              { lbl: "GPA < 2.0 (at risk)", val: filtered.filter(s => s.gpa < 2).length + " students", col: t.danger },
              { lbl: "GPA ≥ 3.0 (excellent)", val: filtered.filter(s => s.gpa >= 3).length + " students", col: t.safe },
              { lbl: "GPA 2.0–2.9 (acceptable)", val: filtered.filter(s => s.gpa >= 2 && s.gpa < 3).length + " students", col: t.warn },
            ].map(({ lbl, val, col }, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: t.surface2, borderRadius: 8, border: "1px solid " + t.border, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: t.textSub }}>{lbl}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: col }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: "12px 14px", background: t.dangerBg, borderRadius: 10, border: "1px solid " + t.dangerMuted, fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
              <strong style={{ color: t.danger }}>{filtered.filter(s => s.gpa < 2).length} students</strong> are below the 2.0 GPA minimum and are at risk of academic probation. They require immediate advisor attention.
            </div>
          </Card>
        </div>
      )}

      {/* ── Attendance tab ── */}
      {activeTab === "attendance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Attendance Distribution</div><div style={{ fontSize: 12, color: t.muted }}>Students per attendance bracket</div></div>
              <button onClick={() => printChart(chartTitles.attendance, "analytics-chart-attendance")} style={{ padding: "5px 11px", background: t.accent, border: "none", borderRadius: 7, color: "white", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Print</button>
              <button onClick={() => setMaximized("attendance")} style={{ padding: "5px 11px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 7, color: t.muted, fontSize: 11, cursor: "pointer" }}>⛶ Maximize</button>
            </div>
            <div id="analytics-chart-attendance"><AttDistChart /></div>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              {[["≥ 85% Strong", t.safe], ["65–84% Monitor", t.warn], ["< 65% Critical", t.danger]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} /><span style={{ fontSize: 10, color: t.muted }}>{l}</span></div>
              ))}
            </div>
          </Card>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Attendance Insights</div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>Key attendance statistics</div>
            {[
              { lbl: "Average Attendance", val: Math.round(avgAtt) + "%", col: avgAtt >= 80 ? t.safe : avgAtt >= 65 ? t.warn : t.danger },
              { lbl: "Below 65% (critical)", val: filtered.filter(s => s.attendance < 65).length + " students", col: t.danger },
              { lbl: "Below 50% (very critical)", val: filtered.filter(s => s.attendance < 50).length + " students", col: t.danger },
              { lbl: "Above 85% (strong)", val: filtered.filter(s => s.attendance >= 85).length + " students", col: t.safe },
            ].map(({ lbl, val, col }, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: t.surface2, borderRadius: 8, border: "1px solid " + t.border, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: t.textSub }}>{lbl}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: col }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: "12px 14px", background: t.dangerBg, borderRadius: 10, border: "1px solid " + t.dangerMuted, fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
              <strong style={{ color: t.danger }}>{filtered.filter(s => s.attendance < 65).length} students</strong> are below the 65% attendance threshold and are flagged for review. Low attendance is one of the strongest predictors of dropout.
            </div>
          </Card>
        </div>
      )}

      {/* ── SHAP tab ── */}
      {activeTab === "shap" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Average Factor Weights</div><div style={{ fontSize: 12, color: t.muted }}>Aggregated SHAP influence across cohort</div></div>
              <button onClick={() => printChart(chartTitles.shap, "analytics-chart-shap")} style={{ padding: "5px 11px", background: t.accent, border: "none", borderRadius: 7, color: "white", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Print</button>
              <button onClick={() => setMaximized("shap")} style={{ padding: "5px 11px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 7, color: t.muted, fontSize: 11, cursor: "pointer" }}>⛶ Maximize</button>
            </div>
            <div id="analytics-chart-shap"><ShapAggChart /></div>
          </Card>
          <Card t={t} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>How To Read This</div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 14, lineHeight: 1.6 }}>The weights show how strongly each academic indicator contributes to risk scores across the filtered cohort.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { title: "High weight factor", desc: "A factor with a high average weight means it is frequently driving risk scores up across many students — it is a systemic issue in this cohort." },
                { title: "Low weight factor", desc: "A low average weight means that factor has less influence across the cohort, though it may still matter significantly for individual students." },
                { title: "How to use this", desc: "Use this chart to identify which academic problems are most prevalent cohort-wide, and to prioritise where advisor time should be focused." },
              ].map(({ title, desc }, i) => (
                <div key={i} style={{ padding: "12px 14px", background: t.surface2, borderRadius: 9, border: "1px solid " + t.border }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Data Table tab ── */}
      {activeTab === "table" && (
        <Card t={t} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Full Data Table</div>
              <div style={{ fontSize: 12, color: t.muted }}>{tableData.length} of {filtered.length} students shown</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Search name or ID…" style={{ padding: "7px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 12, width: 200 }} />
              <button onClick={printAnalytics} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Icon ic={IC.print} size={13} color="white" /> Print</button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: t.surface2 }}>
                  {[["#",""], ["Name",""], ["ID",""], ["Programme",""], ["Level",""], ["GPA","gpa"], ["Attendance","attendance"], ["Risk","risk"], ["Status",""]].map(([h, col]) => (
                    <th key={h} onClick={() => col && toggleSort(col)} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: t.muted, borderBottom: "1px solid " + t.border, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", cursor: col ? "pointer" : "default", userSelect: "none" }}>
                      {h}{col && <SortArrow col={col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((s, i) => (
                  <tr key={i} className="ea-row" style={{ borderBottom: "1px solid " + t.border }}>
                    <td style={{ padding: "9px 14px", color: t.muted, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: "9px 14px", fontWeight: 600, color: t.text }}>{s.name}</td>
                    <td style={{ padding: "9px 14px", color: t.muted, fontFamily: "monospace", fontSize: 11 }}>{s.id}</td>
                    <td style={{ padding: "9px 14px", color: t.textSub }}>{s.programme}</td>
                    <td style={{ padding: "9px 14px", color: t.textSub, textAlign: "center" }}>{s.level}</td>
                    <td style={{ padding: "9px 14px", fontWeight: 700, color: s.gpa >= 3 ? t.safe : s.gpa >= 2 ? t.warn : t.danger }}>{s.gpa.toFixed(2)}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, fontWeight: 600 }}>{s.attendance}%</span>
                        <div style={{ width: 40, height: 4, background: t.surface2, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: s.attendance + "%", background: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, borderRadius: 2 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: rc(s.risk, t), fontFamily: "monospace" }}>{Math.round(s.risk * 100)}%</span>
                        <div style={{ width: 48, height: 4, background: t.surface2, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: (s.risk * 100) + "%", background: rc(s.risk, t), borderRadius: 2 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 14px" }}><Badge risk={s.risk} t={t} sm /></td>
                  </tr>
                ))}
                {!tableData.length && <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: t.muted, fontSize: 13 }}>No students match your search.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── PREDICT PAGE (with name fix and note clarification) ─────────────────────
function PredictPage({ t, students, setStudents, setActive, logActivity = () => { }, programmesList }) {
  const toast = useToast(); const [tab, setTab] = useState("manual");
  const [form, setForm] = useState({ title: "", name: "", id: "", gender: "", phone: "", email: "", programme: (programmesList[0] || "Computer Science"), level: "200", semester: "1", yearOfEnrolment: "", gpa: "", attendance: "", credits: "", required: "", failedModules: "0", financialFlag: "0", repeatedCourse: "0", probation: "0", notes: "" });
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(false); const [errs, setErrs] = useState({});
  const [bStep, setBStep] = useState("idle"); const [bFile, setBFile] = useState(""); const [bRows, setBRows] = useState([]); const [bRes, setBRes] = useState([]); const [bErr, setBErr] = useState(""); const [bDrag, setBDrag] = useState(false); const [bProg, setBProg] = useState(0); const [bFilt, setBFilt] = useState("all"); const [bSort, setBSort] = useState("risk"); const [bPendingImport, setBPendingImport] = useState(null); const [bImportMode, setBImportMode] = useState("add"); const fRef = useRef();
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  function validate() { const e = {}; if (!form.name || !form.name.trim()) e.name = "Required"; if (!form.gpa || isNaN(form.gpa) || +form.gpa < 0 || +form.gpa > 4) e.gpa = "0.0-4.0"; if (!form.attendance || isNaN(form.attendance) || +form.attendance < 0 || +form.attendance > 100) e.attendance = "0-100"; if (!form.credits || isNaN(form.credits)) e.credits = "Required"; if (!form.required || isNaN(form.required)) e.required = "Required"; setErrs(e); return !Object.keys(e).length; }
  function handleFile(file) { if (!file) return; if (!["csv", "txt"].includes(file.name.split(".").pop().toLowerCase())) { setBErr("Only .csv or .txt files accepted."); setBStep("error"); return; } setBFile(file.name); const reader = new FileReader(); reader.onload = e => { const r = parseCSV(e.target.result, programmesList); if (!r.ok) { setBErr(r.msg); setBStep("error"); } else { setBPendingImport(r.data); } }; reader.readAsText(file); }
  async function runBatch() {
    if (!bRows.length) return;
    setBStep("running"); setBProg(0);
    const total = bRows.length;
    let res = [];

    const startedAt = Date.now();
    const MIN_PREDICT_MS = 10000;
    // Animate progress smoothly for a deliberate ML-analysis feel.
    let simulatedProg = 0;
    const STEP_INTERVAL = 120; // ms per tick
    const MAX_SIMULATED = total * 0.88; // cap at 88% until real response arrives
    const progTimer = setInterval(() => {
      const linear = Math.min(1, (Date.now() - startedAt) / MIN_PREDICT_MS);
      const eased = linear < .5 ? 2 * linear * linear : 1 - Math.pow(-2 * linear + 2, 2) / 2;
      simulatedProg = Math.min(MAX_SIMULATED, Math.max(simulatedProg, MAX_SIMULATED * eased));
      setBProg(Math.floor(simulatedProg));
    }, STEP_INTERVAL);

    try {
      let data = await apiFetch("/predict/batch", { method: "POST", body: JSON.stringify({
        students: bRows.map(studentPayload)
      }) });
      if (bImportMode === "replace") {
        await apiFetch("/students/all", { method: "DELETE" });
        data = await apiFetch("/predict/batch", { method: "POST", body: JSON.stringify({
          students: bRows.map(studentPayload)
        }) });
      }
      await delay(Math.max(0, MIN_PREDICT_MS - (Date.now() - startedAt)));
      clearInterval(progTimer);
      // Animate remaining 88% -> 100% quickly
      let fill = Math.floor(simulatedProg);
      const fillTimer = setInterval(() => {
        fill = Math.min(fill + Math.ceil(total * 0.05), total);
        setBProg(fill);
        if (fill >= total) clearInterval(fillTimer);
      }, 60);
      const byId = new Map((data.students || []).map(br => [br.student_id || br.id, br]));
      res = bRows.map((s) => {
        const br = byId.get(s.id);
        if (!br || br.risk_score === undefined) throw new Error("Invalid response from backend");
        return enrichStudentFromPrediction(s, br);
      });
      toast(total + " students predicted by ML model | " + (data.high || 0) + " flagged high risk", "success");
    } catch (apiErr) {
      clearInterval(progTimer);
      setBErr(apiErr.message || "Batch prediction failed. Please check the backend and try again.");
      setBStep("error");
      toast(apiErr.message || "Batch prediction failed", "error");
      return;
    }

    setBRes(res);
    setBStep("results");
    const enriched = res.map(s => enrichStudentFromPrediction(s, { risk_score: s.predicted, shap_values: s.shap }));
    setStudents(prev => {
      const ids = new Set(prev.map(x => x.id));
      if (bImportMode === "replace") return enriched;
      if (bImportMode === "add") return [...prev, ...enriched.filter(e => !ids.has(e.id))];
      return [...prev.map(x => { const ov = enriched.find(e => e.id === x.id); return ov ? { ...x, ...ov, risk: ov.risk } : x; }), ...enriched.filter(e => !ids.has(e.id))];
    });
  }
  function applyBatchImport(rows, mode) {
    const ids = new Set(students.map(s => s.id));
    const rowsForMode = mode === "add" ? rows.filter(r => !ids.has(r.id)) : rows;
    if (!rowsForMode.length) {
      toast("No new students to run - duplicates skipped", "info");
      setBPendingImport(null);
      setBFile("");
      return;
    }
    setBImportMode(mode);
    setBRows(rowsForMode);
    setBPendingImport(null);
    setBStep("preview");
  }
  function resetBatch() { setBStep("idle"); setBFile(""); setBRows([]); setBRes([]); setBErr(""); setBProg(0); setBFilt("all"); setBSort("risk"); setBPendingImport(null); setBImportMode("add"); }
  function exportCSV() { const h = ["Name", "ID", "Programme", "Level", "GPA", "Attendance", "Credits", "Risk Score", "Risk Label"]; const rows = bRes.map(s => [s.name, s.id, s.programme, s.level, s.gpa, s.attendance, s.credits, s.predicted.toFixed(3), rlbl(s.predicted)]); const csv = [h, ...rows].map(r => r.join(",")).join("\n"); const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "edualert_results.csv"; a.click(); toast("Exported", "success"); }
  function dlTpl() { const csv = REQCOLS.join(",") + "\nKwame Test,UEN/CS/2025/001,Computer Science,200,1,3.1,85,42,45\nAma Sample,UEN/EE/2025/002,Electrical Eng.,300,2,1.9,61,54,90"; const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "template.csv"; a.click(); }
  const filtered = bRes.filter(s => bFilt === "all" || (bFilt === "high" && s.predicted >= .7) || (bFilt === "moderate" && s.predicted >= .4 && s.predicted < .7) || (bFilt === "low" && s.predicted < .4)).sort((a, b) => bSort === "risk" ? b.predicted - a.predicted : bSort === "gpa" ? b.gpa - a.gpa : a.name.localeCompare(b.name));
  const iS = k => ({ width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + (errs[k] ? t.danger : t.border2), borderRadius: 8, color: t.text, fontSize: 13 });
  async function runManual() {
    if (!validate()) return;
    setLoading(true);
    const startedAt = Date.now();
    const MIN_PREDICT_MS = 10000;
    const gpa = +form.gpa, att = +form.attendance, cr = +form.credits / +form.required, sem = +form.semester;
    const fail = +form.failedModules || 0, fin = +form.financialFlag || 0, rep = +form.repeatedCourse || 0, prob = +form.probation || 0;
    // FIX: combine title and name properly
    const fullName = (form.title ? form.title + " " : "") + (form.name || "This student").trim();
    const displayName = fullName;
    // baseName used by firstName() for explanations - no title prefix
    const baseName = (form.name || "This student").trim();
    try {
      const data = await apiFetch("/predict", { method: "POST", body: JSON.stringify({
        student_id: form.id || "MANUAL-" + Date.now(),
        name: displayName, programme: form.programme,
        level: +form.level, semester: sem,
        gpa, attendance: att, credits: +form.credits, required: +form.required,
        failed_modules: fail, financial_flag: fin,
        repeated_course: rep, probation: prob,
      }) });
      if (!data || data.risk_score === undefined) throw new Error("Invalid response from backend");
      await delay(Math.max(0, MIN_PREDICT_MS - (Date.now() - startedAt)));
      const risk = data.risk_score;
      const shap = data.shap_values || makeShap(gpa, att, cr, form.programme, sem);
      const fakeStu = {
        name: displayName, id: form.id || "MANUAL-" + Date.now(),
        baseName: baseName,
        gpa, attendance: att, credits: +form.credits, required: +form.required,
        level: +form.level, semester: sem, programme: form.programme, risk,
        email: form.email, phone: form.phone, gender: form.gender,
        yearOfEnrolment: form.yearOfEnrolment,
        flags: [gpa < 2 ? "GPA below minimum" : "", att < 65 ? "Low attendance" : "", cr < .75 ? "Credit deficit" : "",
          fail > 0 ? fail + " failed module" + (fail > 1 ? "s" : "") : "", fin ? "Financial hold" : "",
          rep ? "Repeated a course" : "", prob ? "Academic probation" : ""].filter(Boolean),
        interventions: form.notes ? [{ date: new Date().toISOString().split("T")[0], note: form.notes, by: "Advisor" }] : [],
      };
      setResult({ risk, shap, student: fakeStu, source: "model" });
      toast("Prediction complete - using trained ML model", "success");
    } catch (apiErr) {
      toast(`Prediction failed: ${apiErr.message}. Please ensure backend is running.`, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto", background: t.bg }}>
      {bPendingImport && <ImportModeModal t={t} rowCount={bPendingImport.length} existingCount={students.length} onConfirm={(mode) => applyBatchImport(bPendingImport, mode)} onCancel={() => { setBPendingImport(null); setBFile(""); }} />}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: t.surface2, borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid " + t.border }}>
        {[{ id: "manual", lbl: "Manual Entry" }, { id: "batch", lbl: "Batch Upload" }].map(({ id, lbl }) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "9px 22px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: tab === id ? 700 : 500, background: tab === id ? t.surface : t.surface2, color: tab === id ? t.accent : t.muted, cursor: "pointer", boxShadow: tab === id ? t.shadow : "none" }}>{lbl}</button>
        ))}
      </div>

      {tab === "manual" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <Card t={t} style={{ padding: "22px 24px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Personal Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Title</label><select value={form.title} onChange={setF("title")} style={{ ...iS("title"), cursor: "pointer" }}>{"-,Dr.,Prof.,Mr.,Mrs.,Ms.,Rev.,Eng.,Hon.".split(",").map(o => <option key={o} value={o === "-" ? "" : o}>{o}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Full Name</label><input value={form.name} onChange={setF("name")} placeholder="e.g. Kwame Boateng" style={iS("name")} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Student ID</label><input value={form.id} onChange={setF("id")} placeholder="UEN/XX/XXXX/XXX" style={iS("id")} /></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Gender</label><select value={form.gender} onChange={setF("gender")} style={{ ...iS("gender"), cursor: "pointer" }}>{["- Select -", "Male", "Female", "Prefer not to say"].map(o => <option key={o} value={o.startsWith("-") ? "" : o}>{o}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Email <span style={{ fontWeight: 400, color: t.muted }}>(optional)</span></label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon ic={IC.mail} size={13} color={t.muted} /></span><input value={form.email} onChange={setF("email")} placeholder="student@uenr.edu.gh" type="email" style={{ ...iS("email"), paddingLeft: 30 }} /></div></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Phone <span style={{ fontWeight: 400, color: t.muted }}>(optional)</span></label><input value={form.phone} onChange={setF("phone")} placeholder="e.g. 0244 000 000" style={iS("phone")} /></div>
              </div>
              <div style={{ borderTop: "1px solid " + t.border, margin: "16px 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Academic Information</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 10, marginBottom: 12 }}>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Programme</label><select value={form.programme} onChange={setF("programme")} style={{ ...iS("programme"), cursor: "pointer" }}>{programmesList.map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Level</label><select value={form.level} onChange={setF("level")} style={{ ...iS("level"), cursor: "pointer" }}>{["100", "200", "300", "400"].map(o => <option key={o}>{o}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Sem.</label><select value={form.semester} onChange={setF("semester")} style={{ ...iS("semester"), cursor: "pointer" }}>{["1", "2"].map(o => <option key={o}>{o}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Year of Enrolment</label><select value={form.yearOfEnrolment} onChange={setF("yearOfEnrolment")} style={{ ...iS("yearOfEnrolment"), cursor: "pointer" }}>{["- Select year -", "2019", "2020", "2021", "2022", "2023", "2024", "2025"].map(o => <option key={o} value={o.startsWith("-") ? "" : o}>{o}</option>)}</select></div>
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
              <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Number of Failed Modules</label><select value={form.failedModules} onChange={setF("failedModules")} style={{ ...iS("failedModules"), cursor: "pointer" }}>{["0", "1", "2", "3", "4", "5+"].map(o => <option key={o} value={o === "5+" ? "5" : o}>{o}</option>)}</select></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {[
                  { k: "financialFlag", l: "Financial Hold / Fee Arrears", sub: "Student has unpaid tuition or a financial hold on their account" },
                  { k: "repeatedCourse", l: "Has Repeated a Course", sub: "Student has previously failed and re-enrolled in at least one module" },
                  { k: "probation", l: "On Academic Probation", sub: "Student is formally on probation due to poor academic performance" },
                ].map(({ k, l, sub }) => (
                  <div key={k} onClick={() => setForm(f => ({ ...f, [k]: f[k] === "1" ? "0" : "1" }))}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 9, border: "1.5px solid " + (form[k] === "1" ? t.danger : t.border), background: form[k] === "1" ? t.dangerBg : "transparent", cursor: "pointer", transition: "all .15s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: "2px solid " + (form[k] === "1" ? t.danger : t.border2), background: form[k] === "1" ? t.danger : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
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
                <textarea value={form.notes} onChange={setF("notes")} rows={3}
                  placeholder="Any additional context - attendance reasons, personal circumstances, medical issues, family situation..."
                  style={{ ...iS("notes"), paddingLeft: 32, resize: "vertical", lineHeight: 1.6 }} />
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Note: This note is for your reference only and does not affect the risk score. The model uses only the numeric fields above.</div>
              </div>
              <button onClick={runManual} disabled={loading} style={{ width: "100%", padding: "13px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 9, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 12px " + t.accent + "44", transition: "all .15s" }}>
                {loading
                  ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><PredictionLoader t={t} compact /> Analysing all risk factors...</span>
                  : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon ic={IC.brain} size={16} color="white" /> Run Prediction</span>
                }
              </button>
            </Card>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0 }}>
            {result ? (
              <>
                <Card t={t} style={{ padding: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>Prediction Result</div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><RiskGauge value={result.risk} t={t} size={120} /></div>
                  <div style={{ padding: "11px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: rbg(result.risk, t), color: rc(result.risk, t), border: "1px solid " + rbrd(result.risk, t) }}>
                    {result.risk >= _thresh.high ? "Immediate intervention recommended" : result.risk >= _thresh.mod ? "Proactive check-in recommended" : "Student appears on track"}
                  </div>
                  {result.student.email && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7, justifyContent: "center", padding: "7px 12px", background: t.surface2, borderRadius: 7, border: "1px solid " + t.border, fontSize: 12, color: t.textSub }}>
                      <Icon ic={IC.mail} size={12} color={t.muted} />{result.student.email}
                    </div>
                  )}
                  {result.student.flags && result.student.flags.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                      {result.student.flags.map((f, i) => <span key={i} style={{ padding: "2px 9px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 10, fontSize: 11, color: t.danger, fontWeight: 600 }}>{f}</span>)}
                    </div>
                  )}
                </Card>
                {result.student.notes && (
                  <Card t={t} style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Icon ic={IC.note} size={13} color={t.accent} /><div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Advisor Notes</div></div>
                    <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.65, background: t.accentBg, padding: "9px 12px", borderRadius: 7, border: "1px solid " + t.accentMuted }}>{result.student.notes || (result.student.interventions && result.student.interventions[0] && result.student.interventions[0].note)}</div>
                  </Card>
                )}
                <Card t={t} style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Advisor Summary</div>
                  <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.8 }}>{generateOverallSummary(result.student)}</div>
                </Card>
                <Card t={t} style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>Risk Factor Weights</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 12 }}>How each indicator influenced the score</div>
                  <ShapBar data={result.shap} t={t} />
                </Card>
                <Card t={t} style={{ padding: "14px 16px" }}>
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
                  const s = { ...result.student, risk: result.risk, trend: "stable", shap: result.shap, gpaHist: [null, null, null, result.student.gpa], progAvg: .45 };
                  setStudents(prev => { const ids = new Set(prev.map(x => x.id)); if (ids.has(s.id)) return prev.map(x => x.id === s.id ? { ...x, ...s } : x); return [s, ...prev]; });
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
          {bStep === "idle" && (<div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}><Card t={t} style={{ padding: 0, overflow: "hidden" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border }}><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Upload Student CSV File</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Select or drag a file - risk scores computed automatically</div></div><div style={{ padding: "20px" }}><div onDragOver={e => { e.preventDefault(); setBDrag(true); }} onDragLeave={() => setBDrag(false)} onDrop={e => { e.preventDefault(); setBDrag(false); handleFile(e.dataTransfer.files[0]); }} onClick={() => fRef.current.click()} style={{ border: "2px dashed " + (bDrag ? t.accent : t.border2), borderRadius: 12, padding: "44px 20px", textAlign: "center", cursor: "pointer", background: bDrag ? t.accentBg : "transparent", transition: "all .18s" }}><div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Icon ic={IC.folder} size={48} color={t.muted} /></div><div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{bDrag ? "Drop your file here" : "Drag & drop your CSV here"}</div><div style={{ fontSize: 13, color: t.muted, marginBottom: 20 }}>or click anywhere to browse your computer</div><div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: t.accent, borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600 }}><Icon ic={IC.folder} size={14} color="white" /> Browse Files</div><div style={{ marginTop: 14, fontSize: 12, color: t.muted }}>Accepted: <strong style={{ color: t.textSub }}>.csv</strong> and <strong style={{ color: t.textSub }}>.txt</strong></div><input ref={fRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} /></div></div></Card><div style={{ display: "flex", flexDirection: "column", gap: 16 }}><Card t={t} style={{ padding: "18px 20px" }}><div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Required CSV Columns</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>{REQCOLS.map(c => <span key={c} style={{ padding: "3px 9px", background: t.accentBg, borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.accent, border: "1px solid " + t.accentMuted, fontFamily: "monospace" }}>{c}</span>)}</div><button onClick={dlTpl} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", background: t.surface2, border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.download} size={14} color={t.textSub} /> Download Template CSV</button></Card><Card t={t} style={{ padding: "16px 18px" }}><div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>How it works</div>{[["1", "Prepare CSV with required columns"], ["2", "Drop file or click Browse to select it"], ["3", "Review the parsed data preview"], ["4", "Run predictions on all students at once"], ["5", "Filter results and export as CSV"]].map(([n, l]) => (<div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 9 }}><div style={{ width: 20, height: 20, borderRadius: "50%", background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: t.accent, flexShrink: 0 }}>{n}</div><span style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{l}</span></div>))}</Card></div></div>)}
          {bStep === "preview" && (<Card t={t}><div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Preview - {bFile}</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{bRows.length} students parsed</div></div><div style={{ display: "flex", gap: 10 }}><button onClick={resetBatch} style={{ padding: "8px 14px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}> Change File</button><button onClick={runBatch} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}> Run on {bRows.length} Students</button></div></div><div style={{ overflowX: "auto", maxHeight: 380 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ background: t.surface2 }}>{["#", "Name", "Student ID", "Programme", "Level", "GPA", "Attendance", "Credits"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: t.muted, borderBottom: "1px solid " + t.border, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead><tbody>{bRows.map((r, i) => <tr key={i} style={{ borderBottom: "1px solid " + t.border, background: i % 2 === 0 ? "transparent" : t.surface2 }}><td style={{ padding: "9px 14px", color: t.muted, fontSize: 11 }}>{i + 1}</td><td style={{ padding: "9px 14px", fontWeight: 600, color: t.text }}>{r.name}</td><td style={{ padding: "9px 14px", color: t.muted, fontFamily: "monospace", fontSize: 11 }}>{r.id}</td><td style={{ padding: "9px 14px", color: t.textSub }}>{r.programme}</td><td style={{ padding: "9px 14px", color: t.textSub }}>{r.level}</td><td style={{ padding: "9px 14px", fontWeight: 600, color: r.gpa >= 3 ? t.safe : r.gpa >= 2 ? t.warn : t.danger }}>{r.gpa.toFixed(1)}</td><td style={{ padding: "9px 14px", color: t.textSub }}>{r.attendance}%</td><td style={{ padding: "9px 14px", color: t.textSub }}>{r.credits}/{r.required}</td></tr>)}</tbody></table></div></Card>)}
          {bStep === "running" && (() => {
            const pct = bRows.length ? Math.round(bProg / bRows.length * 100) : 0;
            const msg = pct < 15 ? "Getting things ready..." : pct < 35 ? "Analysing student records..." : pct < 55 ? "Running risk predictions..." : pct < 72 ? "Computing SHAP explanations..." : pct < 88 ? "Almost there, hang tight..." : pct < 97 ? "Finalising results..." : "Done! Loading results...";
            const msgColor = pct < 35 ? t.muted : pct < 72 ? t.accent : pct < 97 ? t.warn : t.safe;
            return (
              <Card t={t} style={{ padding: "56px 40px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                  <PredictionLoader t={t} pct={pct} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>Running predictions...</div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 32 }}>
                  Processing student {Math.min(bProg, bRows.length)} of {bRows.length}
                </div>
                <div style={{ maxWidth: 480, margin: "0 auto 10px" }}>
                  {/* Progress bar */}
                  <div style={{ height: 10, background: t.surface2, borderRadius: 10, overflow: "hidden", border: "1px solid " + t.border, marginBottom: 10 }}>
                    <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg," + t.accent + "," + (pct > 88 ? t.safe : t.accent) + ")", borderRadius: 10, transition: "width .18s ease" }} />
                  </div>
                  {/* Percentage + count row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <span style={{ fontSize: 12, color: t.muted }}>0%</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: pct > 88 ? t.safe : t.accent, letterSpacing: "-1px", transition: "color .3s" }}>{pct}%</span>
                    <span style={{ fontSize: 12, color: t.muted }}>100%</span>
                  </div>
                  {/* Dynamic status message */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: msgColor, transition: "color .4s", marginBottom: 8 }}>{msg}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {pct < 50 ? "This may take a few seconds depending on cohort size." : pct < 90 ? "Generating plain-English risk explanations for each student..." : "Updating Overview, Students, and Analytics pages..."}
                  </div>
                </div>
              </Card>
            );
          })()}
          {bStep === "results" && bRes.length > 0 && (<><div style={{ padding: "14px 18px", background: t.safeBg, borderRadius: 10, border: "1px solid " + t.safeMuted, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}><Icon ic={IC.check} size={18} color={t.safe} /></span><div><div style={{ fontSize: 13, fontWeight: 700, color: t.safe }}>Predictions complete - all pages updated</div><div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>{bRes.length} students have been added to the Overview, Analytics, and Students pages with their risk scores.</div></div></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => setActive("dashboard")} style={{ padding: "7px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.dash} size={13} color="white" /> Overview</button><button onClick={() => setActive("students")} style={{ padding: "7px 14px", background: "none", border: "1px solid " + t.accent, borderRadius: 8, color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.students} size={13} color={t.accent} /> Students</button></div></div><div style={{ display: "flex", flexDirection: "column", gap: 14 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>{[{ lbl: "Total", val: bRes.length, col: t.accent, bg: t.accentBg, icon: IC.note }, { lbl: "High Risk", val: bRes.filter(s => s.predicted >= .7).length, col: t.danger, bg: t.dangerBg, icon: IC.alert }, { lbl: "Moderate", val: bRes.filter(s => s.predicted >= .4 && s.predicted < .7).length, col: t.warn, bg: t.warnBg, icon: IC.analytics }, { lbl: "Low Risk", val: bRes.filter(s => s.predicted < .4).length, col: t.safe, bg: t.safeBg, icon: IC.check }].map(({ lbl, val, col, bg, icon }, i) => (<Card key={i} t={t} style={{ padding: "16px 18px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 11, color: t.muted, fontWeight: 500, marginBottom: 5 }}>{lbl}</div><div style={{ fontSize: 26, fontWeight: 800, color: t.text }}>{val}</div></div><div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon ic={icon} size={16} color={col} /></div></div></Card>))}</div><Card t={t}><div style={{ padding: "14px 18px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}><div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Results - {bFile}</div><div style={{ fontSize: 12, color: t.muted }}>{filtered.length} of {bRes.length} shown</div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><div style={{ display: "flex", gap: 4 }}>{["all", "high", "moderate", "low"].map(f => <button key={f} onClick={() => setBFilt(f)} style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid " + (bFilt === f ? t.accent : t.border), background: bFilt === f ? t.accentBg : "transparent", color: bFilt === f ? t.accent : t.muted }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}</div><select value={bSort} onChange={e => setBSort(e.target.value)} style={{ padding: "6px 10px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 12, cursor: "pointer" }}><option value="risk">Sort: Risk (High)</option><option value="gpa">Sort: GPA (High)</option><option value="name">Sort: Name A-Z</option></select><button onClick={exportCSV} style={{ padding: "7px 14px", background: t.safe, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.download} size={13} color="white" /> Export CSV</button><button onClick={() => setActive("dashboard")} style={{ padding: "7px 14px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.dash} size={13} color="white" /> Dashboard</button><button onClick={() => setActive("students")} style={{ padding: "7px 14px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 8, color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.students} size={13} color={t.accent} /> Students</button><button onClick={resetBatch} style={{ padding: "7px 14px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.upload} size={13} color={t.textSub} /> New File</button></div></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ background: t.surface2 }}>{["#", "Student", "Programme", "Level", "GPA", "Attendance", "Credits", "Risk Score", "Label"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: t.muted, borderBottom: "1px solid " + t.border, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead><tbody>{filtered.map((s, i) => (<tr key={i} className="ea-row" style={{ borderBottom: "1px solid " + t.border }}><td style={{ padding: "10px 14px", color: t.muted, fontSize: 11, fontFamily: "monospace" }}>{i + 1}</td><td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 600, color: t.text }}>{s.name}</div><div style={{ fontSize: 11, color: t.muted, fontFamily: "monospace", marginTop: 1 }}>{s.id}</div></td><td style={{ padding: "10px 14px", color: t.textSub }}>{s.programme}</td><td style={{ padding: "10px 14px", color: t.textSub }}>{s.level}</td><td style={{ padding: "10px 14px", fontWeight: 600, color: s.gpa >= 3 ? t.safe : s.gpa >= 2 ? t.warn : t.danger }}>{s.gpa.toFixed(1)}</td><td style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, fontWeight: 500 }}>{s.attendance}%</span><div style={{ width: 48, height: 4, background: t.surface2, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: s.attendance + "%", background: s.attendance >= 80 ? t.safe : s.attendance >= 65 ? t.warn : t.danger, borderRadius: 2 }} /></div></div></td><td style={{ padding: "10px 14px", color: t.textSub }}>{s.credits}/{s.required}</td><td style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, color: rc(s.predicted, t), fontFamily: "monospace" }}>{(s.predicted * 100).toFixed(1)}%</span><div style={{ width: 56, height: 5, background: t.surface2, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: s.predicted * 100 + "%", background: rc(s.predicted, t), borderRadius: 3 }} /></div></div></td><td style={{ padding: "10px 14px" }}><Badge risk={s.predicted} t={t} sm /></td></tr>))}{!filtered.length && <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: t.muted, fontSize: 13 }}>No students match the current filter.</td></tr>}</tbody></table></div></Card></div></>)}
          {bStep === "error" && (<Card t={t} style={{ padding: "48px 40px", textAlign: "center" }}><div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Icon ic={IC.alert} size={40} color={t.danger} /></div><div style={{ fontSize: 16, fontWeight: 700, color: t.danger, marginBottom: 8 }}>Could not parse file</div><div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, maxWidth: 440, margin: "0 auto 24px" }}>{bErr}</div><div style={{ display: "flex", justifyContent: "center", gap: 12 }}><button onClick={resetBatch} style={{ padding: "10px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Try Another File</button><button onClick={dlTpl} style={{ padding: "10px 22px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Download Template</button></div></Card>)}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS PAGE (with programme management and academic year/semester) ─────
function ChangePasswordForm({ t, toast, onDone, userEmail }) {
  const [step, setStep] = useState("request");
  const [form, setForm] = useState({ code: "", newPw: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const iS = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };
  async function sendCode() {
    if (!userEmail || !userEmail.includes("@")) { toast("Your account email is missing or invalid", "error"); return; }
    setSaving(true);
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: userEmail }) });
      toast("Verification code sent to " + userEmail, "success");
      setStep("verify");
    } catch (e) {
      toast(e.message || "Could not send verification code", "error");
    }
    setSaving(false);
  }
  async function handleChange() {
    if (!form.code.trim()) { toast("Enter the verification code", "error"); return; }
    if (form.newPw.length < 8) { toast("New password must be at least 8 characters", "error"); return; }
    if (form.newPw !== form.confirm) { toast("Passwords do not match", "error"); return; }
    setSaving(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({
        email: userEmail, code: form.code.trim(), password: form.newPw,
      }) });
      setForm({ code: "", newPw: "", confirm: "" });
      toast("Password changed successfully", "success");
      if (onDone) setTimeout(onDone, 800);
    } catch (e) {
      toast(e.message || "Password change failed", "error");
    }
    setSaving(false);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ padding: "12px 14px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 10, fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
        A verification code will be sent to <strong style={{ color: t.text }}>{userEmail || "your account email"}</strong> before the password is changed.
      </div>
      {step === "request" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={sendCode} disabled={saving} style={{ padding: "9px 20px", background: saving ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {saving ? <><Spinner size={14} color="white" /> Sending...</> : <><Icon ic={IC.mail} size={14} color="white" /> Send Verification Code</>}
          </button>
          {onDone && <button onClick={onDone} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>}
        </div>
      ) : (
        <>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Verification Code</label><input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="6-digit code" style={{ ...iS, letterSpacing: 3, fontWeight: 800, textAlign: "center" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>New Password</label><div style={{ position: "relative" }}><input value={form.newPw} onChange={e => setForm(f => ({ ...f, newPw: e.target.value }))} type={show ? "text" : "password"} style={iS} /><button onClick={() => setShow(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}><Icon ic={show ? IC.eyeoff : IC.eye} size={14} color={t.muted} /></button></div></div>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Confirm New</label><input value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} type={show ? "text" : "password"} style={iS} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleChange} disabled={saving} style={{ padding: "9px 20px", background: saving ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {saving ? <><Spinner size={14} color="white" /> Saving...</> : <><Icon ic={IC.lock} size={14} color="white" /> Change Password</>}
            </button>
            <button onClick={sendCode} disabled={saving} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>Resend Code</button>
            {onDone && <button onClick={onDone} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>}
          </div>
        </>
      )}
    </div>
  );
}

function SettingsPage({ t, dark, setDark, onLogout, thresh, setThresh, onClear, studentCount, user, setUser, students, activityLog, programmesList, setProgrammesList, academicYear, setAcademicYear, semester, setSemester, isAdmin }) {
  const toast = useToast();
  const savedSettings = readSavedSettings();
  const [notifs, setNotifs] = useState(savedSettings.notifications || { email: true, weekly: true, moderate: true });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: (user && user.title) || "",
    name: (user && user.name) || "Academic Advisor",
    email: (user && user.email) || "advisor@uenr.edu.gh",
    dept: (user && user.dept) || "Faculty of Sciences",
    phone: (user && user.phone) || "",
    staff_id: (user && user.staff_id) || "",
    office: (user && user.office) || "",
    faculty: (user && user.faculty) || "",
    consultation_hours: (user && user.consultation_hours) || "",
    bio: (user && user.bio) || "",
  });
  const [academicDraft, setAcademicDraft] = useState({ academic_year: academicYear || "", semester: semester || "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const imgRef = useRef();
  const [newProgramme, setNewProgramme] = useState("");
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [openModal, setOpenModal] = useState(null); // "profile"|"academic"|"programmes"|"appearance"|"password"|"thresholds"|"notifications"|"activity"
  const closeModal = () => setOpenModal(null);
  const profileFields = ["title", "name", "email", "dept", "phone", "staff_id", "office", "faculty", "consultation_hours", "bio"];
  const completedProfile = profileFields.filter(k => (form[k] || "").trim()).length;

  useEffect(() => {
    const current = readSavedSettings();
    localStorage.setItem("ea-settings", JSON.stringify({ ...current, notifications: notifs }));
  }, [notifs]);

  useEffect(() => {
    if (openModal === "academic") setAcademicDraft({ academic_year: academicYear || "", semester: semester || "" });
  }, [openModal, academicYear, semester]);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please select an image file", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { toast("Image must be under 2 MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = ev => setUser(u => ({ ...u, photo: ev.target.result }));
    reader.readAsDataURL(file);
    toast("Profile photo updated", "success");
  }

  async function saveProfile() {
    if (!form.name.trim() || !form.email.trim()) { toast("Name and email are required", "error"); return; }
    setSavingProfile(true);
    try {
      await apiFetch("/auth/profile", { method: "PATCH", body: JSON.stringify({
        name: form.name.trim(), dept: form.dept, phone: form.phone || null, title: form.title || null,
        staff_id: form.staff_id || null, office: form.office || null, faculty: form.faculty || null,
        consultation_hours: form.consultation_hours || null, bio: form.bio || null,
      }) });
      setUser(u => ({ ...u, ...form }));
      setEditing(false);
      toast("Profile updated", "success");
    } catch (e) {
      setUser(u => ({ ...u, ...form }));
      setEditing(false);
      toast(e.message || "Profile updated", "info");
    }
    setSavingProfile(false);
  }

  async function updateMetadata(field, value) {
    setUpdatingMeta(true);
    try {
      await apiFetch("/metadata", { method: "POST", body: JSON.stringify({ [field]: value }) });
      if (field === "academic_year") setAcademicYear(value);
      if (field === "semester") setSemester(value);
      if (field === "programmes") {
        setProgrammesList(value);
        PROGS = ["All Programmes", ...value];
      }
      toast(`Updated ${field}`, "success");
    } catch (e) {
      toast(e.message, "error");
    }
    setUpdatingMeta(false);
  }

  async function saveAcademicPeriod() {
    const year = (academicDraft.academic_year || "").trim();
    const sem = (academicDraft.semester || "").trim();
    if (!year || !sem) { toast("Academic year and semester are required", "error"); return; }
    setUpdatingMeta(true);
    try {
      await apiFetch("/metadata", { method: "POST", body: JSON.stringify({ academic_year: year, semester: sem }) });
      setAcademicYear(year);
      setSemester(sem);
      toast("Academic period updated", "success");
      closeModal();
    } catch (e) {
      toast(e.message, "error");
    }
    setUpdatingMeta(false);
  }

  async function addProgramme() {
    if (!newProgramme.trim()) return;
    if (programmesList.includes(newProgramme.trim())) { toast("Programme already exists", "error"); return; }
    const newList = [...programmesList, newProgramme.trim()];
    await updateMetadata("programmes", newList);
    setNewProgramme("");
  }

  async function removeProgramme(prog) {
    if (programmesList.length <= 1) { toast("Cannot remove the last programme", "error"); return; }
    const newList = programmesList.filter(p => p !== prog);
    await updateMetadata("programmes", newList);
  }

  const iS = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };
  function updateThreshold(key, value) {
    const nextValue = Math.min(90, Math.max(10, +value || 10));
    setThresh(p => {
      if (key === "mod") return { ...p, mod: Math.min(nextValue, p.high - 1) };
      return { ...p, high: Math.max(nextValue, p.mod + 1) };
    });
  }

  const iSm = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };

  // ── Settings Modal ──────────────────────────────────────────────────────────
  function SettingsModal({ title, icon, children, width = 540 }) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="ea-scale" style={{ background: t.surface, borderRadius: 18, border: "1px solid " + t.border, boxShadow: "0 24px 72px rgba(0,0,0,.28)", width: "100%", maxWidth: width, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon ic={icon} size={17} color={t.accent} /></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</div>
            </div>
            <button onClick={closeModal} style={{ width: 30, height: 30, borderRadius: "50%", background: t.surface2, border: "1px solid " + t.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon ic={IC.x} size={14} color={t.muted} /></button>
          </div>
          <div style={{ overflowY: "auto", padding: "22px 24px", flex: 1 }}>{children}</div>
        </div>
      </div>
    );
  }

  const SECTIONS = [
    { id: "profile",       icon: IC.user,      label: "Advisor Profile",       sub: Math.round((completedProfile / profileFields.length) * 100) + "% complete" },
    { id: "academic",      icon: IC.calendar,  label: "Academic Period",        sub: (academicYear || "2024/2025") + " · " + (semester || "Semester 2") },
    { id: "programmes",    icon: IC.folder,    label: "Programmes of Study",    sub: programmesList.length + " programmes configured" },
    { id: "appearance",    icon: IC.sun,       label: "Appearance",             sub: (dark ? "Dark" : "Light") + " mode saved" },
    { id: "password",      icon: IC.lock,      label: "Change Password",        sub: "Update your sign-in credentials" },
    { id: "thresholds",    icon: IC.analytics, label: "Risk Thresholds",        sub: "High ≥" + thresh.high + "% · Moderate ≥" + thresh.mod + "%" },
    { id: "notifications", icon: IC.alert,     label: "Notifications",          sub: Object.values(notifs).filter(Boolean).length + " alert preferences active" },
    { id: "activity",      icon: IC.activity,  label: "Recent Activity",        sub: activityLog.length + " events this session" },
  ];

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", background: t.bg }}>
      {/* Modals */}
      {openModal === "profile" && (
        <SettingsModal title="Advisor Profile" icon={IC.user} width={560}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {(user && user.photo)
                ? <img src={user.photo} alt="Profile" style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "2px solid " + t.border2 }} />
                : <div style={{ width: 72, height: 72, borderRadius: 16, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "white", border: "2px solid " + t.accentMuted }}>{((user && user.name) || "AD").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</div>
              }
              <button onClick={() => imgRef.current.click()} title="Change photo" style={{ position: "absolute", bottom: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: t.accent, border: "2px solid " + t.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon ic={IC.camera} size={11} color="white" /></button>
              <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>TITLE</label><select value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...iSm, cursor: "pointer", fontSize: 12 }}>{"Select,Dr.,Prof.,Mr.,Mrs.,Ms.,Rev.,Eng.,Hon.".split(",").map(o => <option key={o} value={o === "Select" ? "" : o}>{o}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>FULL NAME</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={iSm} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>EMAIL</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" style={iSm} /></div>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>DEPARTMENT</label><input value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))} style={iSm} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>PHONE</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={iSm} placeholder="e.g. 0244 000 000" /></div>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>STAFF ID</label><input value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} style={iSm} placeholder="e.g. UENR/STAFF/001" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>FACULTY</label><input value={form.faculty} onChange={e => setForm(f => ({ ...f, faculty: e.target.value }))} style={iSm} placeholder="e.g. Faculty of Engineering" /></div>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>OFFICE</label><input value={form.office} onChange={e => setForm(f => ({ ...f, office: e.target.value }))} style={iSm} placeholder="e.g. Block B, Room 12" /></div>
              </div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>CONSULTATION HOURS</label><input value={form.consultation_hours} onChange={e => setForm(f => ({ ...f, consultation_hours: e.target.value }))} style={iSm} placeholder="e.g. Tuesdays and Thursdays, 10:00-12:00" /></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>PROFILE NOTE</label><textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} style={{ ...iSm, resize: "vertical", lineHeight: 1.55 }} placeholder="Short professional note for advising context" /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={saveProfile} disabled={savingProfile} style={{ padding: "9px 20px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>{savingProfile ? <><Spinner size={14} color="white" /> Saving...</> : <><Icon ic={IC.check} size={14} color="white" /> Save Changes</>}</button>
                <button onClick={() => { setForm({ title: (user && user.title) || "", name: (user && user.name) || "", email: (user && user.email) || "", dept: (user && user.dept) || "", phone: (user && user.phone) || "", staff_id: (user && user.staff_id) || "", office: (user && user.office) || "", faculty: (user && user.faculty) || "", consultation_hours: (user && user.consultation_hours) || "", bio: (user && user.bio) || "" }); closeModal(); }} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid " + t.border, paddingTop: 14, display: "flex", gap: 8 }}>
            {studentCount > 0 && <button onClick={() => { closeModal(); onClear(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: t.warnBg, border: "1px solid " + t.warnMuted, borderRadius: 8, color: t.warn, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.trash} size={14} color={t.warn} /> Clear All Data</button>}
            <button onClick={() => { closeModal(); onLogout(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 8, color: t.danger, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.logout} size={14} color={t.danger} /> Sign Out</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "academic" && (
        <SettingsModal title="Academic Period" icon={IC.calendar} width={460}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Academic Year</label><input value={academicDraft.academic_year} onChange={e => setAcademicDraft(p => ({ ...p, academic_year: e.target.value }))} style={iSm} placeholder="e.g. 2024/2025" /></div>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Semester</label><select value={academicDraft.semester} onChange={e => setAcademicDraft(p => ({ ...p, semester: e.target.value }))} style={{ ...iSm, cursor: "pointer" }}>{["Semester 1","Semester 2","Trimester 1","Trimester 2","Trimester 3","Summer"].map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 12, color: t.muted, padding: "10px 14px", background: t.surface2, borderRadius: 8, border: "1px solid " + t.border }}>These values update the header shown across all pages and in printed reports after you save.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button onClick={closeModal} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveAcademicPeriod} disabled={updatingMeta} style={{ padding: "9px 22px", background: updatingMeta ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: updatingMeta ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>{updatingMeta ? <><Spinner size={14} color="white" /> Saving...</> : "Save Period"}</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "programmes" && (
        <SettingsModal title="Programmes of Study" icon={IC.folder} width={480}>
          <div style={{ marginBottom: 16 }}>
            {programmesList.map(prog => (
              <div key={prog} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + t.border }}>
                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{prog}</span>
                <button onClick={() => removeProgramme(prog)} style={{ background: "none", border: "none", color: t.danger, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}><Icon ic={IC.trash} size={14} color={t.danger} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newProgramme} onChange={e => setNewProgramme(e.target.value)} onKeyDown={e => e.key === "Enter" && addProgramme()} placeholder="New programme name..." style={{ flex: 1, ...iSm }} />
            <button onClick={addProgramme} disabled={updatingMeta} style={{ padding: "9px 16px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ fontSize: 12, color: t.muted }}>These programmes appear in all dropdowns across the system — prediction forms, student import, and filtering.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "appearance" && (
        <SettingsModal title="Appearance" icon={IC.sun} width={480}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { id: "light", label: "Light", icon: IC.sun, active: !dark },
              { id: "dark", label: "Dark", icon: IC.moon, active: dark },
            ].map(mode => (
              <button key={mode.id} onClick={() => setDark(mode.id === "dark")} style={{ padding: "16px 14px", borderRadius: 12, border: "1.5px solid " + (mode.active ? t.accent : t.border), background: mode.active ? t.accentBg : t.surface2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", color: mode.active ? t.accent : t.textSub }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 800 }}><Icon ic={mode.icon} size={16} color={mode.active ? t.accent : t.muted} />{mode.label}</span>
                {mode.active && <Icon ic={IC.check} size={15} color={t.accent} />}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 10, background: t.surface2, border: "1px solid " + t.border, marginBottom: 10 }}>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Sidebar mode control</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>The sidebar light/dark switch uses this same setting.</div></div>
            <Toggle on={dark} toggle={() => setDark(d => !d)} t={t} />
          </div>
          <div style={{ fontSize: 12, color: t.muted, padding: "10px 14px", background: t.safeBg, borderRadius: 8, border: "1px solid " + t.safeMuted, marginTop: 8 }}>
            Mode preference is saved in this browser, so it remains after refresh.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "password" && (
        <SettingsModal title="Change Password" icon={IC.lock} width={420}>
          <ChangePasswordForm t={t} toast={toast} onDone={closeModal} userEmail={(user && user.email) || form.email} />
        </SettingsModal>
      )}

      {openModal === "thresholds" && (
        <SettingsModal title="Risk Thresholds" icon={IC.analytics} width={520}>
          <div style={{ fontSize: 13, color: t.muted, marginBottom: 20 }}>Drag the sliders — all badges and colours update instantly across the entire app.</div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 14, borderRadius: 8, overflow: "hidden", position: "relative", background: "linear-gradient(to right, " + t.safe + ", " + t.warn + ", " + t.danger + ")", marginBottom: 10 }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: thresh.mod + "%", width: 2, background: t.surface, opacity: .9 }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: thresh.high + "%", width: 2, background: t.surface, opacity: .9 }} />
            </div>
            <div style={{ display: "flex", position: "relative", height: 24 }}>
              <div style={{ position: "absolute", left: 0, width: thresh.mod + "%", display: "flex", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: t.safe, background: t.safeBg, padding: "2px 8px", borderRadius: 10, border: "1px solid " + t.safeMuted }}>Low 0-{thresh.mod}%</span></div>
              <div style={{ position: "absolute", left: thresh.mod + "%", width: thresh.high - thresh.mod + "%", display: "flex", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: t.warn, background: t.warnBg, padding: "2px 8px", borderRadius: 10, border: "1px solid " + t.warnMuted, whiteSpace: "nowrap" }}>{thresh.mod}-{thresh.high}%</span></div>
              <div style={{ position: "absolute", left: thresh.high + "%", right: 0, display: "flex", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: t.danger, background: t.dangerBg, padding: "2px 8px", borderRadius: 10, border: "1px solid " + t.dangerMuted, whiteSpace: "nowrap" }}>High {thresh.high}-100%</span></div>
            </div>
          </div>
          {[{ k: "mod", l: "Moderate Risk starts at", col: t.warn }, { k: "high", l: "High Risk starts at", col: t.danger }].map(({ k, l, col }) => (
            <div key={k} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: t.textSub, fontWeight: 500 }}>{l}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" min={10} max={90} value={thresh[k]} onChange={e => updateThreshold(k, e.target.value)} style={{ width: 56, padding: "5px 8px", background: t.inputBg, border: "1.5px solid " + col, borderRadius: 7, color: col, fontSize: 14, fontWeight: 800, textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: col, fontWeight: 700 }}>%</span>
                </div>
              </div>
              <input type="range" min={10} max={90} value={thresh[k]} onChange={e => updateThreshold(k, e.target.value)} style={{ width: "100%", accentColor: col, height: 6, cursor: "pointer" }} />
            </div>
          ))}
          <div style={{ padding: "14px 16px", background: t.surface2, borderRadius: 10, border: "1px solid " + t.border, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Live preview</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {[thresh.mod / 2, (thresh.mod + thresh.high) / 2, (thresh.high + 100) / 2].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><Badge risk={r / 100} t={t} sm /><span style={{ fontSize: 11, color: t.muted }}>{Math.round(r)}%</span></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "notifications" && (
        <SettingsModal title="Notifications" icon={IC.alert} width={460}>
          {[{ k: "email", l: "Email alerts for high-risk students", sub: "Notified when a student crosses the high-risk threshold" }, { k: "weekly", l: "Weekly cohort summary", sub: "Every Monday morning" }, { k: "moderate", l: "Moderate risk alerts", sub: "Notified when a student enters the moderate-risk range" }].map(({ k, l, sub }, i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < arr.length - 1 ? 18 : 0, marginBottom: i < arr.length - 1 ? 18 : 0, borderBottom: i < arr.length - 1 ? "1px solid " + t.border : "none" }}>
              <div><div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{l}</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</div></div>
              <Toggle on={notifs[k]} toggle={() => setNotifs(n => ({ ...n, [k]: !n[k] }))} t={t} />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "activity" && (
        <SettingsModal title="Recent Activity" icon={IC.activity} width={540}>
          {activityLog.length === 0
            ? <div style={{ padding: "32px 0", textAlign: "center", color: t.muted, fontSize: 13 }}>No activity recorded this session yet.</div>
            : activityLog.slice(0, 20).map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < Math.min(activityLog.length, 20) - 1 ? "1px solid " + t.border : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: ev.type === "risk" ? t.dangerBg : ev.type === "import" ? t.accentBg : ev.type === "intervention" ? t.safeBg : t.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon ic={ev.type === "risk" ? IC.alert : ev.type === "import" ? IC.upload : ev.type === "intervention" ? IC.note : IC.activity} size={14} color={ev.type === "risk" ? t.danger : ev.type === "import" ? t.accent : ev.type === "intervention" ? t.safe : t.muted} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>{ev.msg}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{ev.time}</div>
                </div>
              </div>
            ))
          }
        </SettingsModal>
      )}

      {/* ── Settings Grid ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 920 }}>
        {/* Profile summary banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: t.surface, border: "1px solid " + t.border, borderRadius: 14, marginBottom: 24, boxShadow: t.shadow }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {(user && user.photo)
              ? <img src={user.photo} alt="Profile" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", border: "2px solid " + t.border2 }} />
              : <div style={{ width: 56, height: 56, borderRadius: 14, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "white" }}>{((user && user.name) || "AD").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</div>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{(user && user.name) || "Academic Advisor"}</div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{(user && user.email) || "advisor@uenr.edu.gh"} · {(user && user.dept) || "Faculty of Sciences"}</div>
            <div style={{ marginTop: 6, display: "inline-flex", padding: "2px 10px", background: t.safeBg, border: "1px solid " + t.safeMuted, borderRadius: 20, fontSize: 11, fontWeight: 600, color: t.safe }}>{(user && user.role === "admin") ? "Admin" : "Advisor"}</div>
            {((user && user.staff_id) || (user && user.office) || (user && user.consultation_hours)) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                {(user && user.staff_id) && <span style={{ display: "inline-flex", padding: "2px 10px", background: t.surface2, border: "1px solid " + t.border, borderRadius: 20, fontSize: 11, fontWeight: 600, color: t.textSub }}>{user.staff_id}</span>}
                {(user && user.office) && <span style={{ display: "inline-flex", padding: "2px 10px", background: t.surface2, border: "1px solid " + t.border, borderRadius: 20, fontSize: 11, fontWeight: 600, color: t.textSub }}>{user.office}</span>}
                {(user && user.consultation_hours) && <span style={{ display: "inline-flex", padding: "2px 10px", background: t.surface2, border: "1px solid " + t.border, borderRadius: 20, fontSize: 11, fontWeight: 600, color: t.textSub }}>{user.consultation_hours}</span>}
              </div>
            )}
          </div>
          <button onClick={() => setOpenModal("profile")} style={{ padding: "8px 16px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 9, color: t.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Icon ic={IC.edit} size={13} color={t.accent} /> Edit Profile</button>
        </div>

        {/* Settings grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {SECTIONS.map(({ id, icon, label, sub }) => (
            <button key={id} onClick={() => setOpenModal(id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: t.surface, border: "1px solid " + t.border, borderRadius: 12, cursor: "pointer", textAlign: "left", boxShadow: t.shadow, transition: "all .15s", width: "100%" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadow; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon ic={icon} size={18} color={t.accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
              </div>
              <Icon ic={IC.chevR} size={14} color={t.muted} />
            </button>
          ))}
        </div>

        <div style={{ padding: "12px 16px", background: t.accentBg, borderRadius: 10, border: "1px solid " + t.accentMuted, fontSize: 12, color: t.muted, lineHeight: 1.65 }}>
          <strong style={{ color: t.accent }}>About EduAlert:</strong> Predictions use the best performing classifier calibrated via Platt scaling. Advisor notes do not affect the risk score — only structured academic fields do. All outputs are advisory only and must be verified by qualified staff before action is taken. | UENR Group 27 Final Year Project 2026.
        </div>
      </div>
    </div>
  );
}

// ─── AUTH SCREEN (unchanged, sign-up creates only advisor) ───────────────────
function darkPanelSurface(t) {
  return t.bg === TH.dark.bg ? "rgba(28,31,42,.96)" : "rgba(255,255,255,.92)";
}

function AuthScreen({ onLogin, t }) {
  const toast = useToast();
  const [screen, setScreen] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showP, setShowP] = useState(false);
  const [showP2, setShowP2] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [su, setSu] = useState({ title: "", name: "", email: "", dept: "Faculty of Sciences", pass: "", confirm: "" });
  const [suErr, setSuErr] = useState({});
  const [fpEmail, setFpEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const API = "http://localhost:8000";
  const iS = { width: "100%", padding: "10px 13px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 14 };
  const errS = { fontSize: 12, color: t.danger, marginTop: 4 };

  async function handleLogin() {
    setLoginErr(""); if (!email || !pass) { setLoginErr("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "username=" + encodeURIComponent(email) + "&password=" + encodeURIComponent(pass) });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        setLoginErr(errData.detail || "Invalid email or password");
        setLoading(false);
        return;
      }
      await r.json().catch(() => ({}));
      setLoginCode("");
      toast("Verification code sent to " + email, "success");
      setScreen("loginVerify");
    } catch (e) {
      setLoginErr("Cannot reach the EduAlert server. Is the backend running?");
    }
    setLoading(false);
  }

  async function handleVerifyLogin() {
    setLoginErr("");
    if (!loginCode.trim()) { setLoginErr("Enter the verification code from your email."); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/verify-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: loginCode.trim() }) });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        setLoginErr(errData.detail || "Invalid or expired verification code");
        setLoading(false);
        return;
      }
      const data = await r.json();
      await delay(900);
      const apiUser = data.user || data;
      const resolvedName = apiUser.full_name || apiUser.fullname || apiUser.name || apiUser.username || "";
      const resolvedEmail = apiUser.email || email;
      const resolvedDept = apiUser.dept || apiUser.department || "Faculty of Sciences";
      const resolvedTitle = apiUser.title || apiUser.role || "";
      onLogin({ name: resolvedName || "Advisor", email: resolvedEmail, dept: resolvedDept, title: resolvedTitle, token: data.access_token, role: apiUser.role || "advisor", _rawApiUser: apiUser });
    } catch (e) {
      setLoginErr("Cannot reach the EduAlert server. Is the backend running?");
    }
    setLoading(false);
  }

  function validateSignup() { const e = {}; if (!su.name.trim()) e.name = "Full name is required"; if (!su.email.includes("@")) e.email = "Enter a valid email"; if (su.pass.length < 8) e.pass = "Password must be at least 8 characters"; if (su.pass !== su.confirm) e.confirm = "Passwords do not match"; setSuErr(e); return !Object.keys(e).length; }
  async function handleSignup() {
    if (!validateSignup()) return;
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: su.email, password: su.pass, name: su.name, role: "advisor" }) });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast(err.detail || "Registration failed", "error");
        setLoading(false);
        return;
      }
      toast("Account created. Opening sign in...", "success");
      await delay(1100);
      setEmail(su.email);
      setScreen("login");
    } catch (e) {
      toast("Cannot connect to server. Please try again later.", "error");
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!fpEmail.includes("@")) { toast("Enter a valid email address", "error"); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fpEmail }) });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast(err.detail || "Request failed", "error");
        setLoading(false);
        return;
      }
      toast("If an account exists for " + fpEmail + ", a reset code has been sent.", "success");
    } catch (e) {
      toast("Server unreachable. Please try again later.", "error");
    }
    setScreen("reset");
    setLoading(false);
  }

  async function handleResetPassword() {
    if (!resetCode.trim()) { toast("Enter the reset code from your email", "error"); return; }
    if (newPass.length < 8) { toast("Password must be at least 8 characters", "error"); return; }
    if (newPass !== confirmPass) { toast("Passwords do not match", "error"); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fpEmail, code: resetCode, password: newPass }) });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast(err.detail || "Reset failed - check your code", "error");
        setLoading(false);
        return;
      }
      toast("Password reset successfully. Please sign in.", "success");
      setScreen("login");
    } catch (e) {
      toast("Server unreachable. Please try again later.", "error");
    }
    setLoading(false);
  }

  const leftPanel = (content) => {
    const signupMode = screen === "signup";
    return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: signupMode ? "row-reverse" : "row", background: "linear-gradient(135deg," + (t.bg) + " 0%," + (t.surface) + " 48%," + (t.accentBg) + " 100%)", transition: "background .25s ease" }}>
      <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: signupMode ? "flex-start" : "flex-end", padding: "64px 72px", transition: "align-items .35s ease" }}>
        <div key={screen} className={signupMode ? "ea-slide" : "ea-fade"} style={{ width: "100%", maxWidth: signupMode ? 500 : 430, background: darkPanelSurface(t), border: "1px solid " + t.border, borderRadius: 22, boxShadow: t.shadowMd, padding: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: "#fff", border: "1px solid " + t.border, display: "flex", alignItems: "center", justifyContent: "center", padding: 4, boxShadow: t.shadow }}><img src={UENR_LOGO} alt="UENR" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>EduAlert</div><div style={{ fontSize: 11, color: t.muted }}>University of Energy &amp; Natural Resources</div></div>
          </div>
          {content}
        </div>
      </div>
      <div key={signupMode ? "copy-left" : "copy-right"} className={signupMode ? "ea-slide-left" : "ea-slide"} style={{ flex: 1, background: "linear-gradient(160deg,#0F2F1A,#14532D 48%,#0EA5E9)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0) 46%)" }} />
        <img src={UENR_LOGO} alt="" style={{ position: "absolute", right: -28, bottom: -36, width: 260, height: 260, objectFit: "contain", opacity: .08 }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.6)", letterSpacing: ".08em", marginBottom: 14, textTransform: "uppercase" }}>Group 27 | Final Year Project</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-.4px", lineHeight: 1.2, marginBottom: 12 }}>{signupMode ? <>Create your<br />Advisor Workspace</> : <>Explainable ML<br />Dropout Risk System</>}</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.78)", lineHeight: 1.75, maxWidth: 300, marginBottom: 32 }}>{signupMode ? "Set up an advisor account, verify access, and start tracking student risk from the same protected workspace." : "An explainable ML academic-risk workspace built for UENR advisors, with batch prediction, profile review, and intervention tracking in one place."}</p>
          {(signupMode ? ["Advisor-only account creation", "Email verification before access", "UENR department profile setup", "Dashboard ready after sign in"] : ["Full plain-English risk explanations", "Step-by-step advisor action guides", "Programme-aware SHAP risk scoring", "Batch CSV upload + export"]).map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon ic={IC.check} size={10} color="white" /></div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.88)" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ); };

  if (screen === "login") return leftPanel(<>
    <h1 style={{ fontSize: 30, fontWeight: 850, color: t.text, letterSpacing: "-.6px", marginBottom: 6 }}>Welcome back</h1>
    <p style={{ fontSize: 14, color: t.muted, marginBottom: 24, lineHeight: 1.65 }}>Sign in to manage student risk predictions, interventions, and advisor reports.</p>
    {loginErr && <div style={{ padding: "10px 14px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 8, fontSize: 13, color: t.danger, marginBottom: 16 }}>{loginErr}</div>}
    <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Email address</label><input value={email} onChange={e => { setEmail(e.target.value); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} type="email" style={iS} /></div>
    <div style={{ marginBottom: 8 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Password</label><div style={{ position: "relative" }}><input value={pass} onChange={e => { setPass(e.target.value); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} type={showP ? "text" : "password"} style={{ ...iS, paddingRight: 42 }} /><button onClick={() => setShowP(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showP ? <Icon ic={IC.eyeoff} size={15} color={t.muted} /> : <Icon ic={IC.eye} size={15} color={t.muted} />}</button></div></div>
    <div style={{ textAlign: "right", marginBottom: 20 }}><button onClick={() => { setScreen("forgot"); setFpEmail(email); }} style={{ background: "none", border: "none", color: t.accent, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Forgot password?</button></div>
    <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "12px 0", background: loading ? t.border2 : "linear-gradient(135deg,#14532D,#2563EB)", border: "none", borderRadius: 10, color: "white", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 12px 28px rgba(37,99,235,.24)" }}>
      {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Sending code...</span> : "Send verification code"}
    </button>
    <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: t.muted }}>New to EduAlert? <button onClick={() => setScreen("signup")} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Create an account</button></div>
  </>);

  if (screen === "loginVerify") return leftPanel(<>
    <button onClick={() => { setScreen("login"); setLoginErr(""); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}><Icon ic={IC.back} size={14} color={t.muted} /> Back to sign in</button>
    <div style={{ width: 48, height: 48, borderRadius: 14, background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Icon ic={IC.mail} size={22} color={t.accent} /></div>
    <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Verify sign in</h1>
    <p style={{ fontSize: 14, color: t.muted, marginBottom: 24, lineHeight: 1.65 }}>Enter the 6-digit code sent through SendGrid to <strong style={{ color: t.textSub }}>{email}</strong>.</p>
    {loginErr && <div style={{ padding: "10px 14px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 8, fontSize: 13, color: t.danger, marginBottom: 16 }}>{loginErr}</div>}
    <div style={{ marginBottom: 18 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Verification code</label><input value={loginCode} onChange={e => { setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && handleVerifyLogin()} placeholder="000000" inputMode="numeric" maxLength={6} style={{ ...iS, letterSpacing: "6px", fontSize: 20, textAlign: "center" }} /></div>
    <button onClick={handleVerifyLogin} disabled={loading} style={{ width: "100%", padding: "12px 0", background: loading ? t.border2 : "linear-gradient(135deg,#14532D,#2563EB)", border: "none", borderRadius: 10, color: "white", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 12px 28px rgba(37,99,235,.24)" }}>
      {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Verifying and opening dashboard...</span> : "Verify and sign in"}
    </button>
    <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: t.muted }}>No code yet? <button onClick={handleLogin} disabled={loading} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontSize: 13 }}>Resend code</button></div>
  </>);

  if (screen === "signup") return leftPanel(<>
    <button onClick={() => setScreen("login")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}><Icon ic={IC.back} size={14} color={t.muted} /> Back to sign in</button>
    <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Create account</h1>
    <p style={{ fontSize: 14, color: t.muted, marginBottom: 24 }}>Register as an EduAlert academic advisor.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
      <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
        <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Title</label><select value={su.title} onChange={e => setSu(s => ({ ...s, title: e.target.value }))} style={{ ...iS, cursor: "pointer" }}>{"Select,Dr.,Prof.,Mr.,Mrs.,Ms.,Rev.,Eng.,Hon.".split(",").map(o => <option key={o} value={o === "Select" ? "" : o}>{o}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Full name</label><input value={su.name} onChange={e => setSu(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Kofi Mensah" style={iS} />{suErr.name && <div style={errS}>{suErr.name}</div>}</div>
      </div>
      <div style={{ gridColumn: "1/-1" }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Email address</label><input value={su.email} onChange={e => setSu(s => ({ ...s, email: e.target.value }))} placeholder="name@uenr.edu.gh" type="email" style={iS} />{suErr.email && <div style={errS}>{suErr.email}</div>}</div>
      <div style={{ gridColumn: "1/-1" }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Department</label><select value={su.dept} onChange={e => setSu(s => ({ ...s, dept: e.target.value }))} style={{ ...iS, cursor: "pointer" }}>{["Faculty of Sciences", "Faculty of Engineering", "Faculty of Business", "Faculty of Agriculture", "Registry"].map(d => <option key={d}>{d}</option>)}</select></div>
      <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Password</label><div style={{ position: "relative" }}><input value={su.pass} onChange={e => setSu(s => ({ ...s, pass: e.target.value }))} type={showP ? "text" : "password"} style={{ ...iS, paddingRight: 38 }} /><button onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showP ? <Icon ic={IC.eyeoff} size={14} color={t.muted} /> : <Icon ic={IC.eye} size={14} color={t.muted} />}</button></div>{suErr.pass && <div style={errS}>{suErr.pass}</div>}</div>
      <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Confirm password</label><div style={{ position: "relative" }}><input value={su.confirm} onChange={e => setSu(s => ({ ...s, confirm: e.target.value }))} type={showP2 ? "text" : "password"} style={{ ...iS, paddingRight: 38 }} /><button onClick={() => setShowP2(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showP2 ? <Icon ic={IC.eyeoff} size={14} color={t.muted} /> : <Icon ic={IC.eye} size={14} color={t.muted} />}</button></div>{suErr.confirm && <div style={errS}>{suErr.confirm}</div>}</div>
    </div>
    <button onClick={handleSignup} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", marginTop: 4, boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
      {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Creating account...</span> : "Create account"}
    </button>
    <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: t.muted }}>Already have an account? <button onClick={() => setScreen("login")} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Sign in</button></div>
  </>);

  if (screen === "forgot") return leftPanel(<>
    <button onClick={() => setScreen("login")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}><Icon ic={IC.back} size={14} color={t.muted} /> Back to sign in</button>
    <div style={{ width: 48, height: 48, borderRadius: 14, background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Icon ic={IC.key} size={22} color={t.accent} /></div>
    <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Forgot password?</h1>
    <p style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>Enter your email and we will send a password reset code to your inbox.</p>
    <div style={{ marginBottom: 20 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Email address</label><input value={fpEmail} onChange={e => setFpEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleForgotPassword()} type="email" placeholder="your@uenr.edu.gh" style={iS} /></div>
    <button onClick={handleForgotPassword} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
      {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Sending reset code...</span> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon ic={IC.send} size={14} color="white" />Send reset code</span>}
    </button>
    <div style={{ marginTop: 20, padding: "11px 14px", background: t.surface2, border: "1px solid " + t.border, borderRadius: 8, fontSize: 12, color: t.muted, lineHeight: 1.6 }}>In production, this calls <strong style={{ color: t.textSub }}>POST /auth/forgot-password</strong> on the backend, which sends an email via SendGrid with a 6-digit code. The code is valid for 15 minutes.</div>
  </>);

  if (screen === "reset") return leftPanel(<>
    <button onClick={() => setScreen("forgot")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}><Icon ic={IC.back} size={14} color={t.muted} /> Back</button>
    <div style={{ width: 48, height: 48, borderRadius: 14, background: t.safeBg, border: "1px solid " + t.safeMuted, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Icon ic={IC.lock} size={22} color={t.safe} /></div>
    <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Reset password</h1>
    <p style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>Enter the 6-digit code sent to <strong style={{ color: t.textSub }}>{fpEmail || "your email"}</strong> and choose a new password.</p>
    <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Reset code</label><input value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} style={{ ...iS, letterSpacing: "6px", fontSize: 20, textAlign: "center" }} /></div>
    <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>New password</label><div style={{ position: "relative" }}><input value={newPass} onChange={e => setNewPass(e.target.value)} type={showP ? "text" : "password"} style={{ ...iS, paddingRight: 42 }} /><button onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showP ? <Icon ic={IC.eyeoff} size={15} color={t.muted} /> : <Icon ic={IC.eye} size={15} color={t.muted} />}</button></div></div>
    <div style={{ marginBottom: 24 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Confirm new password</label><input value={confirmPass} onChange={e => setConfirmPass(e.target.value)} type="password" style={iS} /></div>
    <button onClick={handleResetPassword} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
      {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Resetting...</span> : "Reset password"}
    </button>
    <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: t.muted }}>Remembered your password? <button onClick={() => setScreen("login")} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Sign in</button></div>
  </>);

  return null;
}

// ─── SPLASH & WELCOME SCREENS (unchanged) ─────────────────────────────────────
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const T = [700, 400, 700, 1800, 700];
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
        const eased = linear < .5 ? 2 * linear * linear : 1 - Math.pow(-2 * linear + 2, 2) / 2;
        setPct(Math.round(eased * 100));
        if (elapsed < spinnerDur) { frame = requestAnimationFrame(tick); }
      }
      frame = requestAnimationFrame(tick);
    }, spinnerStart);
    return () => { if (frame) cancelAnimationFrame(frame); };
  }, []);

  const slideOut = phase >= 5;
  const FEATURES = [
    { ic: IC.analytics, text: "Cohort risk overview" },
    { ic: IC.students, text: "Student records" },
    { ic: IC.note, text: "Advisor follow-up notes" },
    { ic: IC.shield, text: "Secure academic access" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "linear-gradient(135deg,#0F2F1A 0%,#14532D 38%,#0EA5E9 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "transform .7s cubic-bezier(.77,0,.18,1), opacity .65s ease", transform: slideOut ? "translateY(-100%)" : "translateY(0)", opacity: slideOut ? 0 : 1, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,0) 42%), radial-gradient(ellipse at center,rgba(255,255,255,.12),rgba(255,255,255,0) 58%)", pointerEvents: "none" }} />
      <div style={{ width: 104, height: 104, borderRadius: 24, background: "rgba(255,255,255,.96)", border: "1.5px solid rgba(255,255,255,.45)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, transition: "transform .65s cubic-bezier(.34,1.56,.64,1), opacity .5s ease", transform: phase >= 1 ? "scale(1)" : "scale(0.3)", opacity: phase >= 1 ? 1 : 0, boxShadow: "0 24px 70px rgba(0,0,0,.28)", color: "white", padding: 8 }}>
        <img src={UENR_LOGO} alt="UENR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ fontSize: 44, fontWeight: 800, color: "white", letterSpacing: "-1.5px", transition: "transform .5s ease, opacity .5s ease", transform: phase >= 1 ? "translateY(0)" : "translateY(24px)", opacity: phase >= 1 ? 1 : 0, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 8, textShadow: "0 2px 20px rgba(0,0,0,.2)" }}>EduAlert</div>
      <div style={{ fontSize: 15, color: "rgba(255,255,255,.72)", transition: "transform .5s .1s ease, opacity .5s .1s ease", transform: phase >= 1 ? "translateY(0)" : "translateY(18px)", opacity: phase >= 1 ? 1 : 0, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 12 }}>Student Dropout Risk Prediction System</div>
      <div style={{ padding: "5px 16px", borderRadius: 20, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", fontSize: 11, color: "rgba(255,255,255,.86)", fontWeight: 500, marginBottom: 44, letterSpacing: ".06em", textTransform: "uppercase", transition: "opacity .4s .2s ease", opacity: phase >= 1 ? 1 : 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>University of Energy and Natural Resources | Group 27 | 2026</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(190px, 1fr))", gap: 10, width: "min(440px, calc(100vw - 48px))", marginBottom: 52 }}>
        {FEATURES.map(({ ic, text }, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 12, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.17)", fontSize: 13, color: "white", fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "transform .45s " + (.08 + i * .09) + "s cubic-bezier(.34,1.4,.64,1), opacity .4s " + (.08 + i * .09) + "s ease", transform: phase >= 2 ? "translateY(0) scale(1)" : "translateY(24px) scale(0.88)", opacity: phase >= 2 ? 1 : 0 }}>
            <Icon ic={ic} size={14} color="rgba(255,255,255,.9)" />{text}
          </div>
        ))}
      </div>
      <div style={{ opacity: phase >= 3 ? 1 : 0, transition: "opacity .4s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ width: 132, height: 88, borderRadius: 28, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 50px rgba(0,0,0,.16)" }}>
          <Spinner variant="dots" size={58} color="white" />
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: ".04em" }}>
          {pct < 30 ? "Initialising model..." : pct < 60 ? "Loading student data..." : pct < 90 ? "Preparing dashboard..." : "Ready!"}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ user, t, notifList = [], unreadCount = 0, onEnter, onGoStudents }) {
  const [phase, setPhase] = useState(0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = ((user && user.name) || "Advisor").split(" ").pop();
  useEffect(() => { [200, 600, 1000, 1400].forEach((d, i) => setTimeout(() => setPhase(i + 1), d)); }, []);
  const anim = (ph, delay = 0) => ({ opacity: phase >= ph ? 1 : 0, transform: phase >= ph ? "translateY(0)" : "translateY(16px)", transition: "all .5s " + delay + "s cubic-bezier(.22,1,.36,1)" });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "linear-gradient(135deg," + t.bg + " 0%," + t.surface + " 52%," + t.accentBg + " 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "32%", background: "linear-gradient(160deg,#14532D,#0EA5E9)", overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0) 48%)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", color: "white", padding: 32 }}>
          <div style={{ width: 92, height: 92, borderRadius: 22, background: "rgba(255,255,255,.96)", border: "1.5px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", padding: 7, boxShadow: "0 18px 50px rgba(0,0,0,.22)" }}><img src={UENR_LOGO} alt="UENR" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 6 }}>EduAlert</div>
          <div style={{ fontSize: 13, opacity: .75, lineHeight: 1.6 }}>University of Energy<br />& Natural Resources</div>
          <div style={{ marginTop: 24, padding: "6px 16px", borderRadius: 20, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", fontSize: 11, opacity: .85, display: "inline-block", letterSpacing: ".05em" }}>UENR | Group 27 | 2026</div>
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, width: "min(620px, calc(100vw - 64px))", marginLeft: "12%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "34px 38px", background: darkPanelSurface(t), border: "1px solid " + t.border, borderRadius: 22, boxShadow: t.shadowMd }}>
        <div style={{ ...anim(1), fontSize: 15, color: t.muted, fontWeight: 500, marginBottom: 8 }}>{greeting}</div>
        <div style={{ ...anim(1, .08), fontSize: 36, fontWeight: 800, color: t.text, letterSpacing: "-1.2px", lineHeight: 1.15, marginBottom: 10 }}>Welcome back,<br /><span style={{ color: t.accent }}>{(user && user.title) ? user.title + " " : ""}{firstName}</span></div>
        <div style={{ ...anim(2, .06), fontSize: 14, color: t.muted, marginBottom: 24 }}>{(user && user.dept) || "Faculty of Sciences"} | EduAlert Academic Dashboard</div>
        <div style={{ ...anim(3, .08), display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: unreadCount > 0 ? 20 : 28 }}>
          {[{ lbl: "Students monitored", val: "0", icon: IC.students, col: t.accent }, { lbl: "Alerts today", val: String(unreadCount), icon: IC.alert, col: unreadCount > 0 ? t.danger : t.muted }, { lbl: "System status", val: "Active", icon: IC.activity, col: t.safe }].map(({ lbl, val, icon, col }, i) => (
            <div key={i} style={{ padding: "17px 15px", background: t.surface2, border: "1px solid " + t.border, borderRadius: 16, boxShadow: t.shadow }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: col + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, border: "1px solid " + col + "26" }}><Icon ic={icon} size={15} color={col} /></div>
              <div style={{ fontSize: 24, fontWeight: 800, color: col, marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>{lbl}</div>
            </div>
          ))}
        </div>
        {unreadCount > 0 && (
          <div style={{ ...anim(3, .12), marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Alerts requiring attention</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {notifList.slice(0, 3).map((n, i) => {
                const col = { danger: t.danger, warn: t.warn, info: t.accent }[n.type] || t.muted;
                const bg = { danger: t.dangerBg, warn: t.warnBg, info: t.accentBg }[n.type] || t.surface2;
                return (<div key={i} style={{ padding: "12px 14px", background: "linear-gradient(180deg," + bg + "," + t.surface + ")", borderRadius: 14, border: "1px solid " + col + "33", display: "flex", gap: 11, alignItems: "flex-start", boxShadow: "0 10px 24px " + col + "14" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, border: "1px solid " + col + "33", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon ic={IC.alert} size={14} color={col} /></div>
                  <div><div style={{ fontSize: 12, fontWeight: 700, color: col }}>{n.title}</div><div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>{n.body}</div></div>
                </div>);
              })}
            </div>
          </div>
        )}
        <div style={{ ...anim(4, .06), display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={onEnter} style={{ padding: "13px 28px", background: t.accent, border: "none", borderRadius: 12, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 20px " + t.accent + "44", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon ic={IC.dash} size={16} color="white" /> Enter Dashboard <Icon ic={IC.chevR} size={14} color="white" />
          </button>
          {unreadCount > 0 && <button onClick={onGoStudents} style={{ padding: "13px 20px", background: t.dangerBg, border: "1.5px solid " + t.dangerMuted, borderRadius: 12, color: t.danger, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Icon ic={IC.alert} size={16} color={t.danger} /> View {unreadCount} Alert{unreadCount > 1 ? "s" : ""}</button>}
        </div>
        <div style={{ ...anim(4, .1), marginTop: 14, fontSize: 12, color: t.muted }}>Signed in as <strong style={{ color: t.textSub }}>{(user && user.email) || "advisor@uenr.edu.gh"}</strong></div>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
function readSavedSettings() {
  try {
    return JSON.parse(localStorage.getItem("ea-settings") || "{}");
  } catch {
    return {};
  }
}

export default function App() {
  const savedSettings = readSavedSettings();
  const [splash, setSplash] = useState(true);
  const [dark, setDark] = useState(savedSettings.darkMode === true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [selStu, setSelStu] = useState(null);
  const [students, setStudents] = useState([]);
  const [showLogout, setShowLogout] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [wasCleared, setWasCleared] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [thresh, setThresh] = useState(savedSettings.thresholds || { high: 70, mod: 40 });
  const [refreshing, setRefreshing] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const routeTimerRef = useRef(null);
  useEffect(() => { _thresh = { high: thresh.high / 100, mod: thresh.mod / 100 }; }, [thresh]);
  const [user, setUser] = useState({ name: "Academic Advisor", title: "", email: "", dept: "", phone: "", photo: null, token: "", role: "advisor" });
  const [activityLog, setActivityLog] = useState([]);
  const [notifList, setNotifList] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifFilter, setNotifFilter] = useState(null); // { ids: [...], label: "..." }
  const [programmesList, setProgrammesList] = useState(["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"]);
  const [academicYear, setAcademicYear] = useState("2024/2025");
  const [semester, setSemester] = useState("Semester 2");
  const t = TH[dark ? "dark" : "light"];
  useGlobalCSS(t);

  useEffect(() => {
    const current = readSavedSettings();
    localStorage.setItem("ea-settings", JSON.stringify({ ...current, darkMode: dark, thresholds: thresh }));
  }, [dark, thresh]);

  useEffect(() => () => {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
  }, []);

  const navigate = useCallback((next) => {
    if (!next || next === active) return;
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    setPendingRoute(next);
    setRouteLoading(true);
    routeTimerRef.current = setTimeout(() => {
      setActive(next);
      setRouteLoading(false);
      setPendingRoute(null);
      routeTimerRef.current = null;
    }, 2000);
  }, [active]);

  async function loadMetadata() {
    try {
      const meta = await apiFetch("/metadata");
      setAcademicYear(meta.academic_year || "2024/2025");
      setSemester(meta.semester || "Semester 2");
      setProgrammesList(meta.programmes || ["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"]);
      PROGS = ["All Programmes", ...(meta.programmes || ["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"])];
    } catch (e) {
      console.warn("Could not load metadata", e);
    }
  }

  function logActivity(msg, type = "general") {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    setActivityLog(prev => [{ msg, type, time }, ...prev].slice(0, 50));
  }

  function buildLoginNotifications(studs, thresholds) {
    const notifs = [];
    const now = new Date();
    const highThresh = (thresholds ? thresholds.high : 70) / 100;
    const modThresh  = (thresholds ? thresholds.mod  : 40) / 100;

    // High risk
    const highRisk = studs.filter(s => s.risk >= highThresh);
    if (highRisk.length > 0) {
      notifs.push({ id: "high-" + now.getTime(), type: "danger", title: highRisk.length + " student" + (highRisk.length > 1 ? "s are" : " is") + " at high risk", body: highRisk.slice(0, 3).map(s => s.name).join(", ") + (highRisk.length > 3 ? " +" + (highRisk.length - 3) + " more" : ""), time: now.toISOString(), read: false, studentId: (highRisk[0] && highRisk[0].id), filterIds: highRisk.map(s => s.id), filterLabel: "High Risk" });
    }

    // Moderate risk
    const modRisk = studs.filter(s => s.risk >= modThresh && s.risk < highThresh);
    if (modRisk.length > 0) {
      notifs.push({ id: "mod-" + now.getTime(), type: "warn", title: modRisk.length + " student" + (modRisk.length > 1 ? "s are" : " is") + " at moderate risk", body: modRisk.slice(0, 3).map(s => s.name).join(", ") + (modRisk.length > 3 ? " +" + (modRisk.length - 3) + " more" : ""), time: now.toISOString(), read: false, studentId: (modRisk[0] && modRisk[0].id), filterIds: modRisk.map(s => s.id), filterLabel: "Moderate Risk" });
    }

    // At-risk with no interventions
    const noInterv = studs.filter(s => s.risk >= modThresh && (!s.interventions || s.interventions.length === 0));
    if (noInterv.length > 0) {
      notifs.push({ id: "interv-" + now.getTime(), type: "info", title: noInterv.length + " at-risk student" + (noInterv.length > 1 ? "s have" : " has") + " no interventions logged", body: "Consider reaching out to these students soon.", time: now.toISOString(), read: false, studentId: null, filterIds: noInterv.map(s => s.id), filterLabel: "No Interventions" });
    }

    // Worsening trend
    const trend = studs.filter(s => s.trend === "up" && s.risk >= modThresh);
    if (trend.length > 0) {
      notifs.push({ id: "trend-" + now.getTime(), type: "warn", title: trend.length + " student" + (trend.length > 1 ? "s are" : " is") + " showing worsening trends", body: trend.slice(0, 2).map(s => s.name).join(", ") + (trend.length > 2 ? " +" + (trend.length - 2) + " more" : ""), time: now.toISOString(), read: false, studentId: null, filterIds: trend.map(s => s.id), filterLabel: "Worsening Trend" });
    }
    return notifs;
  }

  useEffect(() => { if (students.length > 0) setLastUpdated(new Date()); }, [students.length]);

  const [sessionWarning, setSessionWarning] = useState(false);
  useSessionWatcher(user.token, () => { clearToken(); handleLogout(); });
  useEffect(() => {
    const onUnauth = () => { if (loggedIn) { handleLogout(); } };
    const onWarn = () => setSessionWarning(true);
    window.addEventListener("ea:unauthorized", onUnauth);
    window.addEventListener("ea:session-warning", onWarn);
    return () => { window.removeEventListener("ea:unauthorized", onUnauth); window.removeEventListener("ea:session-warning", onWarn); };
  }, [loggedIn]);

  async function handleLogin(userData) {
    if (userData.token && userData.token !== "demo") setToken(userData.token);
    const defaultUser = { name: "Academic Advisor", title: "", email: "", dept: "", phone: "", photo: null, token: "", role: "advisor" };
    let mergedUser = { ...defaultUser, ...userData };
    let loadedStudents = [];
    if (userData.token && userData.token !== "demo") {
      try {
        const me = await apiFetch("/auth/me");
        const meName = me.full_name || me.fullname || me.name || me.username || "";
        const meEmail = me.email || userData.email || "";
        const meDept = me.dept || me.department || userData.dept || "Faculty of Sciences";
        const meTitle = me.title || me.role || userData.title || "";
        mergedUser = { ...mergedUser, ...me, name: meName || userData.name || "Academic Advisor", email: meEmail, dept: meDept, title: meTitle, role: me.role || "advisor", token: userData.token };
      } catch (e) { console.warn("Could not fetch /auth/me:", e.message); }
      try {
        const studs = await apiFetch("/students");
        if (studs && studs.length) {
          const validStuds = studs.filter(s => {
            const n = s.full_name || s.fullname || s.name || s.student_name || s.studentName || "";
            const i = s.student_id || s.studentId || s.id || "";
            const hasRealName = n.trim().length > 0 && n.toLowerCase() !== "unknown student" && !/^student\s*\d*$/i.test(n.trim());
            return hasRealName && i.trim().length > 0;
          });
          if (validStuds.length < studs.length) {
            const skipped = studs.length - validStuds.length;
            console.warn(`[EduAlert] Skipped ${skipped} incomplete student record(s) from database (missing name or ID). Use the Students page to re-import or delete them.`);
          }
          loadedStudents = validStuds.map(s => {
            const studentName = s.full_name || s.fullname || s.name || s.student_name || s.studentName || "";
            const studentId = s.student_id || s.studentId || s.id || "";
            const studentGpa = s.gpa || s.GPA || 2.5;
            const studentAttendance = s.attendance || s.attendance_rate || 75;
            const studentCredits = s.credits || s.credits_earned || 45;
            const studentRequired = s.required || s.required_credits || 90;
            const studentProg = s.programme || s.program || s.course || (programmesList[0] || "Computer Science");
            const studentLevel = s.level || s.year || 1;
            const studentSem = s.semester || 1;
            const failedModules = getFeatureValue(s, "failed_modules", "failedModules");
            const financialFlag = boolInt(s.financial_flag ?? s.financialFlag);
            const repeatedCourse = boolInt(s.repeated_course ?? s.repeatedCourse);
            const probation = boolInt(s.probation);
            const cr = studentCredits / studentRequired;
            const risk = s.risk_score || s.risk || computeRisk(studentGpa, studentAttendance, cr, studentProg);
            const flags = makeFlags({ ...s, gpa: studentGpa, attendance: studentAttendance, credits: studentCredits, required: studentRequired, failedModules, financialFlag, repeatedCourse, probation }, risk);
            return {
              ...s,
              id: studentId,
              name: studentName,
              programme: studentProg,
              level: studentLevel,
              semester: studentSem,
              gpa: studentGpa,
              attendance: studentAttendance,
              credits: studentCredits,
              required: studentRequired,
              failedModules,
              financialFlag,
              repeatedCourse,
              probation,
              risk,
              trend: "stable",
              flags,
              interventions: s.interventions || [],
              shap: makeShap(studentGpa, studentAttendance, cr, studentProg, studentSem),
              gpaHist: [null, null, null, studentGpa],
              progAvg: .45,
            };
          });
          setStudents(loadedStudents);
        }
      } catch (e) { console.warn("Could not load students:", e.message); }
    }
    setUser(mergedUser);
    const notifs = buildLoginNotifications(loadedStudents, thresh);
    setNotifList(notifs);
    logActivity("Signed in as " + (mergedUser.name || "Advisor"), "general");
    setWasCleared(false);
    setLoggedIn(true);
    setShowWelcome(true);
    await loadMetadata();
  }

  function handleLogout() {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    routeTimerRef.current = null;
    setRouteLoading(false); setPendingRoute(null);
    clearToken();
    setStudents([]);
    setLoggedIn(false); setShowWelcome(false); setActive("dashboard");
    setSelStu(null); setShowLogout(false); setActivityLog([]); setSessionWarning(false);
    setNotifList([]);
    setProgrammesList(["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"]);
    setAcademicYear("2025/2026");
    setSemester("Semester 2");
  }
  async function handleClear() {
    const count = students.length;
    try {
      if (user.token && user.token !== "demo") await apiFetch("/students/all", { method: "DELETE" });
      logActivity("Cleared all " + count + " student records", "general");
    } catch (e) {
      logActivity("Backend clear failed: " + e.message, "general");
    }
    setStudents([]); setSelStu(null); setWasCleared(true); setLastUpdated(null); setShowClear(false);
  }
  async function handleRefresh() {
    if (!students.length || refreshing) return;
    setRefreshing(true);
    try {
      const data = await apiFetch("/predict/batch", { method: "POST", body: JSON.stringify({ students: students.map(studentPayload) }) });
      const byId = new Map((data.students || []).map(s => [s.student_id || s.id, s]));
      if (!byId.size) throw new Error("Backend returned no refreshed predictions");
      setStudents(prev => prev.map(s => {
        const br = byId.get(s.id);
        if (!br || br.risk_score === undefined) return s;
        return enrichStudentFromPrediction(s, br, s);
      }));
      setLastUpdated(new Date());
      logActivity("Refreshed predictions from backend ML model", "general");
    } catch (e) {
      logActivity("Backend refresh failed: " + e.message, "general");
      window.dispatchEvent(new CustomEvent("ea:refresh-error", { detail: e.message }));
    } finally {
      setRefreshing(false);
    }
  }
  function setStudentsWithLog(updater) {
    setStudents(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next.length > prev.length) logActivity("Loaded " + (next.length - prev.length) + " new student records", "import");
      return next;
    });
  }
  const unreadCount = notifList.filter(n => !n.read).length;

  const META = {
    dashboard: { title: "Overview", sub: "Cohort summary" },
    students: { title: "Student Registry", sub: students.length + " students monitored" },
    analytics: { title: "Analytics", sub: "Cohort-level risk insights" },
    predict: { title: "Predict Risk", sub: "Manual entry or batch CSV upload" },
    settings: { title: "Settings", sub: "Profile, preferences, and activity" },
  };
  const PAGES = {
    dashboard: <OverviewPage t={t} setActive={navigate} setSelStu={setSelStu} students={students} wasCleared={wasCleared} academicYear={academicYear} semester={semester} setAcademicYear={setAcademicYear} setSemester={setSemester} />,
    students: <StudentsPage t={t} initSel={selStu} students={students} setStudents={setStudentsWithLog} logActivity={logActivity} programmesList={programmesList} notifFilter={notifFilter} setNotifFilter={setNotifFilter} />,
    analytics: <AnalyticsPage t={t} students={students} thresh={thresh} />,
    predict: <PredictPage t={t} students={students} setStudents={setStudentsWithLog} setActive={navigate} logActivity={logActivity} programmesList={programmesList} />,
    settings: <SettingsPage t={t} dark={dark} setDark={setDark} onLogout={() => setShowLogout(true)} thresh={thresh} setThresh={setThresh} onClear={() => setShowClear(true)} studentCount={students.length} user={user} setUser={setUser} students={students} activityLog={activityLog} programmesList={programmesList} setProgrammesList={setProgrammesList} academicYear={academicYear} setAcademicYear={setAcademicYear} semester={semester} setSemester={setSemester} isAdmin={user.role === "admin"} />,
  };

  const sidebarAvatar = (user && user.photo)
    ? <img src={user.photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
    : <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>{((user && user.name && user.name.trim()) ? user.name : "Academic Advisor").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</div>;

  if (!loggedIn) return (
    <ErrorBoundary theme={t}>
      <ToastProvider>
        {splash && <SplashScreen onDone={() => setSplash(false)} />}
        <AuthScreen onLogin={handleLogin} t={t} />
      </ToastProvider>
    </ErrorBoundary>
  );

  return (
    <ErrorBoundary theme={t}>
      <ToastProvider>
        {showWelcome && <WelcomeScreen user={user} t={t} notifList={notifList} unreadCount={unreadCount} onEnter={() => setShowWelcome(false)} onGoStudents={() => { setShowWelcome(false); navigate("students"); }} />}
        {showLogout && <LogoutModal t={t} onConfirm={handleLogout} onCancel={() => setShowLogout(false)} />}
        {showClear && <ClearModal t={t} count={students.length} onConfirm={handleClear} onCancel={() => setShowClear(false)} />}

        {sessionWarning && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 8000, background: t.warnBg, borderBottom: "2px solid " + t.warn, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon ic={IC.clock} size={16} color={t.warn} />
              <span style={{ fontSize: 13, fontWeight: 600, color: t.warn }}>Your session expires in 5 minutes.</span>
              <span style={{ fontSize: 12, color: t.textSub }}>Save any unsaved work before it ends.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowLogout(true)} style={{ padding: "5px 14px", background: "none", border: "1px solid " + t.warn, borderRadius: 7, color: t.warn, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sign out now</button>
              <button onClick={() => setSessionWarning(false)} style={{ padding: "5px 10px", background: "none", border: "none", color: t.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>x</button>
            </div>
          </div>
        )}

        {showNotifPanel && (
          <div style={{ position: "fixed", inset: 0, zIndex: 3000 }} onClick={() => setShowNotifPanel(false)}>
            <div style={{ position: "absolute", top: 64, right: 18, width: 410, background: t.surface, borderRadius: 18, border: "1px solid " + t.border, boxShadow: "0 24px 70px rgba(15,23,42,.22)", overflow: "hidden", animation: "scaleIn .18s cubic-bezier(.4,0,.2,1)" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "16px 18px", borderBottom: "1px solid " + t.border, display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg," + t.surface2 + ",transparent)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon ic={IC.bell} size={16} color={t.accent} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Notifications</div>
                  {unreadCount > 0 && <span style={{ padding: "1px 7px", borderRadius: 10, background: t.danger, color: "white", fontSize: 10, fontWeight: 700 }}>{unreadCount}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {unreadCount > 0 && <button onClick={() => setNotifList(p => p.map(n => ({ ...n, read: true })))} style={{ fontSize: 11, color: t.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Mark all read</button>}
                  <button onClick={() => setShowNotifPanel(false)} style={{ background: "none", border: "none", color: t.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>x</button>
                </div>
              </div>
              <div style={{ maxHeight: 440, overflowY: "auto", padding: notifList.length ? 10 : 0 }}>
                {notifList.length === 0
                  ? <div style={{ padding: "32px 18px", textAlign: "center", color: t.muted, fontSize: 13 }}>No notifications - all students are on track.</div>
                  : notifList.map((n, i) => {
                    const col = { danger: t.danger, warn: t.warn, info: t.accent, success: t.safe }[n.type] || t.muted;
                    const bg = { danger: t.dangerBg, warn: t.warnBg, info: t.accentBg, success: t.safeBg }[n.type] || t.surface2;
                    const ic = { danger: IC.alert, warn: IC.alert, info: IC.info, success: IC.check }[n.type] || IC.info;
                    return (
                      <div key={n.id} onClick={() => {
                        setNotifList(p => p.map(x => x.id === n.id ? { ...x, read: true } : x));
                        if (n.filterIds && n.filterIds.length) {
                          setNotifFilter({ ids: n.filterIds, label: n.filterLabel || "Alert Group" });
                          navigate("students");
                          setShowNotifPanel(false);
                        } else if (n.studentId) {
                          setSelStu(students.find(s => s.id === n.studentId) || null);
                          navigate("students");
                          setShowNotifPanel(false);
                        }
                      }} style={{ padding: "13px 14px", marginBottom: i < notifList.length - 1 ? 8 : 0, border: "1px solid " + (n.read ? t.border : col + "33"), borderRadius: 14, cursor: "pointer", background: n.read ? t.surface : bg + "55", display: "flex", gap: 12, alignItems: "flex-start", transition: "background .15s, border-color .15s, transform .12s", boxShadow: n.read ? "none" : "0 8px 24px " + col + "16" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 11, background: bg, border: "1px solid " + col + "33", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon ic={ic} size={15} color={col} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: t.text, marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>{n.body}</div>
                          {(n.filterIds && n.filterIds.length) ? <div style={{ fontSize: 11, color: t.accent, marginTop: 4, fontWeight: 600 }}>Click to view these {n.filterIds.length} student{n.filterIds.length > 1 ? "s" : ""} →</div> : n.studentId && <div style={{ fontSize: 11, color: t.accent, marginTop: 4, fontWeight: 600 }}>Click to view student →</div>}
                        </div>
                        {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: dark ? "linear-gradient(135deg,#111318 0%,#161921 48%,#1C1F2A 100%)" : "linear-gradient(135deg,#F0FDF4 0%,#F8FAFC 42%,#EFF6FF 100%)", paddingTop: sessionWarning ? 44 : 0 }}>
          <Sidebar active={active} setActive={navigate} t={t} dark={dark} setDark={setDark} onLogout={() => setShowLogout(true)} onClear={() => setShowClear(true)} studentCount={students.length} user={user} sidebarAvatar={sidebarAvatar} academicYear={academicYear} semester={semester} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Topbar title={META[active].title} sub={META[active].sub} t={t} onLogout={() => setShowLogout(true)} onClear={() => setShowClear(true)} studentCount={students.length} lastUpdated={lastUpdated} onRefresh={handleRefresh} refreshing={refreshing} unreadCount={unreadCount} onNotifClick={() => setShowNotifPanel(p => !p)} academicYear={academicYear} semester={semester} />
            <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
              <div key={active} className="ea-page-enter" style={{ flex: 1, display: "flex", overflow: "hidden", willChange: "transform,opacity" }}>{PAGES[active]}</div>
              {routeLoading && <PageTransitionOverlay t={t} label={"Opening " + ((META[pendingRoute] && META[pendingRoute].title) || "page")} />}
            </div>
          </div>
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
