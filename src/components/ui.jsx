import React, { useState } from "react";
import { useApp } from "../context";
import Icon from "./icons";
import { IC } from "./icons";
import { rc, rbg, rbrd, rlbl } from "../utils";

export function Spinner({ size = 20, color = "white", thickness = 2.5 }) {
  const r = size / 2 - thickness;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ animation: "spinnerRotate 1.2s linear infinite", flexShrink: 0 }} viewBox={"0 0 " + size + " " + size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color + "33"} strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circ * .72 + " " + circ * .28}
        strokeDashoffset={0}
        style={{ transformOrigin: "center", animation: "spinnerRotate 0.9s cubic-bezier(.5,.1,.5,.9) infinite" }}
      />
    </svg>
  );
}

export function Card({ children, style = {}, hover, onClick }) {
  const { t } = useApp();
  const baseStyle = {
    background: `linear-gradient(135deg, ${t.surface}, ${t.surface2})`,
    border: "1px solid " + t.border,
    borderRadius: 12,
    boxShadow: t.shadow3d,
    ...style,
  };
  return (
    <div className={hover ? "ea-card-3d" : ""} onClick={onClick} style={baseStyle}>
      {children}
    </div>
  );
}

export function Badge({ risk, sm }) {
  const { t } = useApp();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: sm ? "2px 8px" : "4px 10px", borderRadius: 20,
      fontSize: sm ? 11 : 12, fontWeight: 600,
      background: rbg(risk, t), color: rc(risk, t), border: "1px solid " + rbrd(risk, t),
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: rc(risk, t), flexShrink: 0 }} />
      {rlbl(risk)}
    </span>
  );
}

export function Avatar({ name, risk, size = 36 }) {
  const { t } = useApp();
  const safeName = (name && typeof name === "string" && name.trim()) ? name : "??";
  const ini = safeName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * .28, flexShrink: 0,
      background: rbg(risk, t), border: "1.5px solid " + rbrd(risk, t),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * .35, fontWeight: 700, color: rc(risk, t), userSelect: "none",
    }}>
      {ini}
    </div>
  );
}

export function Bar({ pct, color, h = 6 }) {
  const { t } = useApp();
  return (
    <div style={{ height: h, background: t.surface2, borderRadius: h, overflow: "hidden" }}>
      <div className="ea-gbar" style={{ height: "100%", width: Math.min(100, Math.max(0, pct) * 100) + "%", background: color, borderRadius: h }} />
    </div>
  );
}

export function Sparkline({ trend }) {
  const { t } = useApp();
  const pts = { up: "0,18 8,14 16,16 24,10 32,6 40,2", down: "0,2 8,6 16,4 24,10 32,14 40,18", stable: "0,10 8,8 16,11 24,9 32,10 40,9" }[trend] || "0,10 40,10";
  const col = trend === "up" ? t.danger : trend === "down" ? t.safe : t.warn;
  return (
    <svg width={40} height={20} viewBox="0 0 40 20">
      <polyline points={pts} fill="none" stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RiskGauge({ value, size = 100 }) {
  const { t } = useApp();
  const r = size * .36, cx = size / 2, cy = size / 2;
  const rad = d => d * Math.PI / 180;
  const arc = (cx, cy, r, s, e) => {
    const S = { x: cx + r * Math.cos(rad(s)), y: cy + r * Math.sin(rad(s)) },
          E = { x: cx + r * Math.cos(rad(e)), y: cy + r * Math.sin(rad(e)) };
    return `M${S.x} ${S.y}A${r} ${r} 0 ${(e - s) > 180 ? 1 : 0} 1 ${E.x} ${E.y}`;
  };
  return (
    <svg width={size} height={size}>
      <path d={arc(cx, cy, r, 135, 405)} fill="none" stroke={t.border} strokeWidth={size * .07} strokeLinecap="round" />
      <path d={arc(cx, cy, r, 135, 135 + 270 * value)} fill="none" stroke={rc(value, t)} strokeWidth={size * .07} strokeLinecap="round" />
      <text x={cx} y={cy + 3} textAnchor="middle" fill={t.text} fontSize={size * .18} fontWeight="700" fontFamily="Plus Jakarta Sans,sans-serif">{Math.round(value * 100)}%</text>
      <text x={cx} y={cy + size * .17} textAnchor="middle" fill={t.muted} fontSize={size * .1} fontFamily="Plus Jakarta Sans,sans-serif">{rlbl(value)}</text>
    </svg>
  );
}

export function ShapBar({ data }) {
  const { t } = useApp();
  const mx = Math.max(...data.map(d => Math.abs(d.v)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: t.textSub }}>{d.f}</span>
            <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 500, color: d.v > 0 ? t.danger : t.safe }}>{d.v > 0 ? "+" : ""}{d.v.toFixed(2)}</span>
          </div>
          <div style={{ height: 6, background: t.surface2, borderRadius: 3, overflow: "hidden" }}>
            <div className="ea-gbar" style={{ height: "100%", width: Math.abs(d.v) / mx * 100 + "%", background: d.v > 0 ? t.danger : t.safe, borderRadius: 3, opacity: .85 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Toggle({ on, toggle }) {
  const { t } = useApp();
  return (
    <div role="switch" tabIndex={0} onClick={toggle} onKeyDown={e => e.key === "Enter" && toggle()}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: on ? t.accent : t.border2, position: "relative",
        cursor: "pointer", transition: "background .2s", flexShrink: 0,
      }}>
      <div style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </div>
  );
}

export function GpaTrend({ hist, avg }) {
  const { t } = useApp();
  const valid = hist.filter(v => v != null);
  if (!valid.length) return <div style={{ fontSize: 12, color: t.muted, padding: "12px 0" }}>Not enough data.</div>;
  const w = 260, h = 80, pad = 24, lbls = ["S1", "S2", "S3", "S4"].slice(0, hist.length);
  const mn = Math.max(0, Math.min(...valid) - .3), mx = Math.min(4, Math.max(...valid) + .3), rng = mx - mn || 1;
  const xs = hist.map((_, i) => pad + (i / (hist.length - 1 || 1)) * (w - pad * 2));
  const ys = hist.map(v => v == null ? null : h - 4 - ((v - mn) / rng) * (h - 12));
  const pts = hist.map((v, i) => v != null ? xs[i] + "," + ys[i] : null).filter(Boolean).join(" ");
  const ay = Math.max(4, Math.min(h - 4, h - 4 - ((avg * 4 - mn) / rng) * (h - 12)));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={pad} y1={ay} x2={w - pad} y2={ay} stroke={t.warn} strokeWidth={1} strokeDasharray="4 3" opacity={.6} />
      {pts && <polyline points={pts} fill="none" stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {hist.map((v, i) => v != null && (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r={4} fill={t.surface} stroke={t.accent} strokeWidth={2} />
          <text x={xs[i]} y={h} fill={t.muted} fontSize={9} textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">{lbls[i]}</text>
          <text x={xs[i]} y={ys[i] - 7} fill={t.text} fontSize={9} textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif">{v.toFixed(1)}</text>
        </g>
      ))}
    </svg>
  );
}

export function Empty({ icon, title, sub, action }) {
  const { t } = useApp();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 48, textAlign: "center" }}>
      <div style={{ opacity: .22, display: "flex", justifyContent: "center" }}>
        <Icon ic={typeof icon === "string" ? IC.folder : icon} size={44} color={t.muted} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: t.muted, maxWidth: 300, lineHeight: 1.6 }}>{sub}</div>}
      {action}
    </div>
  );
}

export function Modal({ onClose, children, width = 640 }) {
  const { t } = useApp();
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.46)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: t.surface, borderRadius: 16, border: "1px solid " + t.border,
        boxShadow: "0 20px 60px rgba(0,0,0,.22)", width: "100%", maxWidth: width,
        maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Chart components ──────────────────────────────────────────────────────
export function PieDonutChart({ high, mod, low, total, donut, colors = {} }) {
  const { t } = useApp();
  const colH = colors.high || t.danger;
  const colM = colors.moderate || t.warn;
  const colL = colors.low || t.safe;
  const data = [
    { lbl: "High Risk", val: high, col: colH },
    { lbl: "Moderate", val: mod, col: colM },
    { lbl: "Low Risk", val: low, col: colL },
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
      ? `M${xi1} ${yi1} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${xi2} ${yi2} A${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`
      : `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    const midA = angle - sweep / 2;
    return { ...d, path, pct: Math.round(d.val / total * 100) };
  });
  const [hov, setHov] = useState(null);
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
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: hov && hov !== s.lbl ? .4 : 1 }}
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

export function BarChartOv({ high, mod, low, total, colors = {} }) {
  const { t } = useApp();
  const items = [
    { lbl: "High Risk", val: high, col: colors.high || t.danger },
    { lbl: "Moderate", val: mod, col: colors.moderate || t.warn },
    { lbl: "Low Risk", val: low, col: colors.low || t.safe },
  ];
  const max = Math.max(...items.map(d => d.val), 1);
  const [hov, setHov] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
      {items.map((item, i) => {
        const pct = Math.round(item.val / total * 100) || 0;
        const isH = hov === item.lbl;
        return (
          <div key={i} onMouseEnter={() => setHov(item.lbl)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: isH ? item.col : t.textSub, fontWeight: isH ? 700 : 500 }}>{item.lbl}</span>
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

export function HistogramOv({ students, colors = {} }) {
  const { t } = useApp();
  const buckets = Array.from({ length: 10 }, (_, i) => ({ lo: i * 0.1, hi: (i + 1) * 0.1, students: [] }));
  students.forEach(s => { const b = Math.min(9, Math.floor(s.risk * 10)); buckets[b].students.push(s); });
  const max = Math.max(...buckets.map(b => b.students.length), 1);
  const [hov, setHov] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, marginBottom: 6 }}>
        {buckets.map((b, i) => {
          const h = (b.students.length / max) * 100;
          const col = b.lo >= 0.7 ? (colors.high || t.danger) : b.lo >= 0.4 ? (colors.moderate || t.warn) : (colors.low || t.safe);
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
        {["0","10","20","30","40","50","60","70","80","90","100"].map(v => <span key={v}>{v}</span>)}
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

export function StackedBarChart({ students, programmesList, colors = {} }) {
  const { t } = useApp();
  const progs = programmesList.filter(p => p !== "All Programmes");
  const data = progs.map(prog => {
    const ps = students.filter(s => s.programme === prog);
    const high = ps.filter(s => s.risk >= 0.7).length;
    const mod = ps.filter(s => s.risk >= 0.4 && s.risk < 0.7).length;
    const low = ps.filter(s => s.risk < 0.4).length;
    return { prog, high, mod, low, total: ps.length };
  }).filter(d => d.total > 0);
  if (!data.length) return <div style={{ padding: 20, textAlign: "center", color: t.muted }}>No data for selected programmes.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map(({ prog, high, mod, low, total }) => (
        <div key={prog} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 100, fontSize: 12, color: t.textSub }}>{prog}</span>
          <div style={{ flex: 1, height: 16, background: t.surface2, borderRadius: 4, overflow: "hidden", display: "flex" }}>
            {high > 0 && <div style={{ width: (high / total * 100) + "%", background: colors.high || t.danger }} />}
            {mod > 0 && <div style={{ width: (mod / total * 100) + "%", background: colors.moderate || t.warn }} />}
            {low > 0 && <div style={{ width: (low / total * 100) + "%", background: colors.low || t.safe }} />}
          </div>
          <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600, minWidth: 24 }}>{total}</span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, background: colors.high || t.danger, borderRadius: 2 }} /><span style={{ fontSize: 11, color: t.muted }}>High</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, background: colors.moderate || t.warn, borderRadius: 2 }} /><span style={{ fontSize: 11, color: t.muted }}>Moderate</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, background: colors.low || t.safe, borderRadius: 2 }} /><span style={{ fontSize: 11, color: t.muted }}>Low</span></div>
      </div>
    </div>
  );
}