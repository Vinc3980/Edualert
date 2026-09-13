import React, { useState } from "react";
import { useApp, useToast } from "../context";
import Icon, { IC } from "../components/icons";
import { Spinner } from "../components/ui";

export default function AuthScreen({ onLogin }) {
  const { t } = useApp();
  const toast = useToast();

  const [screen, setScreen] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showP, setShowP] = useState(false);
  const [showP2, setShowP2] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [su, setSu] = useState({ title: "", name: "", email: "", dept: "Faculty of Sciences", pass: "", confirm: "" });
  const [suErr, setSuErr] = useState({});
  const [fpEmail, setFpEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";
  const iS = { width: "100%", padding: "10px 13px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 14 };
  const errS = { fontSize: 12, color: t.danger, marginTop: 4 };

  async function handleLogin() {
    setLoginErr("");
    if (!email || !pass) { setLoginErr("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=" + encodeURIComponent(email) + "&password=" + encodeURIComponent(pass),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        setLoginErr(errData.detail || "Invalid email or password");
        setLoading(false);
        return;
      }
      const data = await r.json();
      const apiUser = data.user || data;
      const resolvedName = apiUser.full_name || apiUser.fullname || apiUser.name || apiUser.username || "";
      const resolvedEmail = apiUser.email || email;
      const resolvedDept = apiUser.dept || apiUser.department || "Faculty of Sciences";
      const resolvedTitle = apiUser.title || apiUser.role || "";
      onLogin({
        name: resolvedName || "Advisor",
        email: resolvedEmail,
        dept: resolvedDept,
        title: resolvedTitle,
        token: data.access_token,
        role: apiUser.role || "advisor",
      });
    } catch (e) {
      setLoginErr("Cannot reach the EduAlert server. Is the backend running?");
    }
    setLoading(false);
  }

  function validateSignup() {
    const e = {};
    if (!su.name.trim()) e.name = "Full name is required";
    if (!su.email.includes("@")) e.email = "Enter a valid email";
    if (su.pass.length < 8) e.pass = "Password must be at least 8 characters";
    if (su.pass !== su.confirm) e.confirm = "Passwords do not match";
    setSuErr(e);
    return !Object.keys(e).length;
  }

  async function handleSignup() {
    if (!validateSignup()) return;
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: su.email, password: su.pass, name: su.name, role: "advisor" }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast(err.detail || "Registration failed", "error");
        setLoading(false);
        return;
      }
      toast("Account created! Please sign in.", "success");
      setScreen("login");
      setEmail(su.email);
    } catch (e) {
      toast("Cannot connect to server. Please try again later.", "error");
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!fpEmail.includes("@")) { toast("Enter a valid email address", "error"); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail }),
      });
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
      const r = await fetch(API + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail, code: resetCode, password: newPass }),
      });
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

  const leftPanel = (content) => (
    <div style={{ minHeight: "100vh", display: "flex", background: t.bg }}>
      <div style={{ flex: "0 0 55%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 72px", background: t.surface }}>
        <div className="ea-fade" style={{ maxWidth: 400 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon ic={IC.logo} size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>EduAlert</div>
              <div style={{ fontSize: 11, color: t.muted }}>University of Energy &amp; Natural Resources</div>
            </div>
          </div>
          {content}
        </div>
      </div>
      <div style={{ flex: 1, background: t.accent, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.6)", letterSpacing: ".08em", marginBottom: 14, textTransform: "uppercase" }}>Group 27 | Final Year Project</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-.4px", lineHeight: 1.2, marginBottom: 12 }}>Explainable ML<br />Dropout Risk System</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.75)", lineHeight: 1.75, maxWidth: 280, marginBottom: 32 }}>The first dropout prediction system built specifically for UENR - with plain-English explanations every advisor can understand and act on.</p>
          {[
            "Full plain-English risk explanations",
            "Step-by-step advisor action guides",
            "Programme-aware SHAP risk scoring",
            "Batch CSV upload + export"
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon ic={IC.check} size={10} color="white" />
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.88)" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (screen === "login") {
    return leftPanel(
      <>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>Sign in to access the academic advisor dashboard.</p>
        {loginErr && (
          <div style={{ padding: "10px 14px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 8, fontSize: 13, color: t.danger, marginBottom: 16 }}>
            {loginErr}
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Email address</label>
          <input value={email} onChange={e => { setEmail(e.target.value); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} type="email" style={iS} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Password</label>
          <div style={{ position: "relative" }}>
            <input value={pass} onChange={e => { setPass(e.target.value); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} type={showP ? "text" : "password"} style={{ ...iS, paddingRight: 42 }} />
            <button onClick={() => setShowP(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {showP ? <Icon ic={IC.eyeoff} size={15} color={t.muted} /> : <Icon ic={IC.eye} size={15} color={t.muted} />}
            </button>
          </div>
        </div>
        <div style={{ textAlign: "right", marginBottom: 20 }}>
          <button onClick={() => { setScreen("forgot"); setFpEmail(email); }} style={{ background: "none", border: "none", color: t.accent, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Forgot password?</button>
        </div>
        <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
          {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Signing in...</span> : "Sign in ->"}
        </button>
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: t.muted }}>New to EduAlert? <button onClick={() => setScreen("signup")} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Create an account</button></div>
      </>
    );
  }

  if (screen === "signup") {
    return leftPanel(
      <>
        <button onClick={() => setScreen("login")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}>
          <Icon ic={IC.back} size={14} color={t.muted} /> Back to sign in
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Create account</h1>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 24 }}>Register as an EduAlert academic advisor.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Title</label><select value={su.title} onChange={e => setSu(s => ({ ...s, title: e.target.value }))} style={{ ...iS, cursor: "pointer" }}>{"Select,Dr.,Prof.,Mr.,Mrs.,Ms.,Rev.,Eng.,Hon.".split(",").map(o => <option key={o} value={o === "Select" ? "" : o}>{o}</option>)}</select></div>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Full name</label><input value={su.name} onChange={e => setSu(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Kofi Mensah" style={iS} />{suErr.name && <div style={errS}>{suErr.name}</div>}</div>
          </div>
          <div style={{ gridColumn: "1/-1" }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Email address</label><input value={su.email} onChange={e => setSu(s => ({ ...s, email: e.target.value }))} placeholder="name@uenr.edu.gh" type="email" style={iS} />{suErr.email && <div style={errS}>{suErr.email}</div>}</div>
          <div style={{ gridColumn: "1/-1" }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Department</label><select value={su.dept} onChange={e => setSu(s => ({ ...s, dept: e.target.value }))} style={{ ...iS, cursor: "pointer" }}>{["Faculty of Sciences","Faculty of Engineering","Faculty of Business","Faculty of Agriculture","Registry"].map(d => <option key={d}>{d}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Password</label><div style={{ position: "relative" }}><input value={su.pass} onChange={e => setSu(s => ({ ...s, pass: e.target.value }))} type={showP ? "text" : "password"} style={{ ...iS, paddingRight: 38 }} /><button onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showP ? <Icon ic={IC.eyeoff} size={14} color={t.muted} /> : <Icon ic={IC.eye} size={14} color={t.muted} />}</button></div>{suErr.pass && <div style={errS}>{suErr.pass}</div>}</div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Confirm password</label><div style={{ position: "relative" }}><input value={su.confirm} onChange={e => setSu(s => ({ ...s, confirm: e.target.value }))} type={showP2 ? "text" : "password"} style={{ ...iS, paddingRight: 38 }} /><button onClick={() => setShowP2(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showP2 ? <Icon ic={IC.eyeoff} size={14} color={t.muted} /> : <Icon ic={IC.eye} size={14} color={t.muted} />}</button></div>{suErr.confirm && <div style={errS}>{suErr.confirm}</div>}</div>
        </div>
        <button onClick={handleSignup} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", marginTop: 4, boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
          {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Creating account...</span> : "Create account ->"}
        </button>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: t.muted }}>Already have an account? <button onClick={() => setScreen("login")} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Sign in</button></div>
      </>
    );
  }

  if (screen === "forgot") {
    return leftPanel(
      <>
        <button onClick={() => setScreen("login")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}>
          <Icon ic={IC.back} size={14} color={t.muted} /> Back to sign in
        </button>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: t.accentBg, border: "1px solid " + t.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon ic={IC.key} size={22} color={t.accent} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Forgot password?</h1>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>Enter your email and we will send a password reset code to your inbox.</p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Email address</label>
          <input value={fpEmail} onChange={e => setFpEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleForgotPassword()} type="email" placeholder="your@uenr.edu.gh" style={iS} />
        </div>
        <button onClick={handleForgotPassword} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
          {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Sending reset code...</span> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon ic={IC.send} size={14} color="white" />Send reset code</span>}
        </button>
        <div style={{ marginTop: 20, padding: "11px 14px", background: t.surface2, border: "1px solid " + t.border, borderRadius: 8, fontSize: 12, color: t.muted, lineHeight: 1.6 }}>
          In production, this calls <strong style={{ color: t.textSub }}>POST /auth/forgot-password</strong> on the backend, which sends an email via SendGrid with a 6-digit code. The code is valid for 15 minutes.
        </div>
      </>
    );
  }

  if (screen === "reset") {
    return leftPanel(
      <>
        <button onClick={() => setScreen("forgot")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.muted, fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0 }}>
          <Icon ic={IC.back} size={14} color={t.muted} /> Back
        </button>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: t.safeBg, border: "1px solid " + t.safeMuted, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon ic={IC.lock} size={22} color={t.safe} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-.4px", marginBottom: 6 }}>Reset password</h1>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>Enter the 6-digit code sent to <strong style={{ color: t.textSub }}>{fpEmail || "your email"}</strong> and choose a new password.</p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Reset code</label>
          <input value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} style={{ ...iS, letterSpacing: "6px", fontSize: 20, textAlign: "center" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>New password</label>
          <div style={{ position: "relative" }}>
            <input value={newPass} onChange={e => setNewPass(e.target.value)} type={showP ? "text" : "password"} style={{ ...iS, paddingRight: 42 }} />
            <button onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {showP ? <Icon ic={IC.eyeoff} size={15} color={t.muted} /> : <Icon ic={IC.eye} size={15} color={t.muted} />}
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>Confirm new password</label>
          <input value={confirmPass} onChange={e => setConfirmPass(e.target.value)} type="password" style={iS} />
        </div>
        <button onClick={handleResetPassword} disabled={loading} style={{ width: "100%", padding: "11px 0", background: loading ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 10px rgba(37,99,235,.3)" }}>
          {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner />Resetting...</span> : "Reset password ->"}
        </button>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: t.muted }}>Remembered your password? <button onClick={() => setScreen("login")} style={{ background: "none", border: "none", color: t.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Sign in</button></div>
      </>
    );
  }

  return null;
}