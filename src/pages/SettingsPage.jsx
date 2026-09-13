import React, { useState, useRef } from "react";
import { useApp, useToast } from "../context";
import { Card, Toggle, Spinner, Modal } from "../components/ui";
import Icon, { IC } from "../components/icons";
import { apiFetch } from "../utils";

function ChangePasswordForm({ onDone }) {
  const { t } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ current: "", newPw: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const iS = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };

  async function handleChange() {
    if (!form.current) { toast("Enter your current password", "error"); return; }
    if (form.newPw.length < 8) { toast("New password must be at least 8 characters", "error"); return; }
    if (form.newPw !== form.confirm) { toast("Passwords do not match", "error"); return; }
    setSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST", body: JSON.stringify({ current_password: form.current, new_password: form.newPw })
      });
      setForm({ current: "", newPw: "", confirm: "" });
      toast("Password changed successfully", "success");
      if (onDone) setTimeout(onDone, 800);
    } catch (e) { toast(e.message || "Password change failed", "error"); }
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Current Password</label>
        <div style={{ position: "relative" }}>
          <input value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} type={show ? "text" : "password"} style={iS} />
          <button onClick={() => setShow(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
            <Icon ic={show ? IC.eyeoff : IC.eye} size={14} color={t.muted} />
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>New Password</label><input value={form.newPw} onChange={e => setForm(f => ({ ...f, newPw: e.target.value }))} type="password" style={iS} /></div>
        <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Confirm New</label><input value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} type="password" style={iS} /></div>
      </div>
      <div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleChange} disabled={saving} style={{ padding: "9px 20px", background: saving ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {saving ? <><Spinner size={14} color="white" /> Saving...</> : <><Icon ic={IC.lock} size={14} color="white" /> Update Password</>}
          </button>
          {onDone && <button onClick={onDone} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage({ onLogout, onClear }) {
  const {
    t, dark, setDark, thresh, setThresh, students, user, setUser,
    programmesList, setProgrammesList, academicYear, setAcademicYear,
    semester, setSemester, activityLog,
  } = useApp();
  const toast = useToast();

  const [notifs, setNotifs] = useState({ email: true, weekly: true, critical: true });
  const [form, setForm] = useState({
    title: user?.title || "", name: user?.name || "Academic Advisor",
    email: user?.email || "advisor@uenr.edu.gh", dept: user?.dept || "Faculty of Sciences",
    phone: user?.phone || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const imgRef = useRef();
  const [newProgramme, setNewProgramme] = useState("");
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [openModal, setOpenModal] = useState(null);
  const closeModal = () => setOpenModal(null);

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
      await apiFetch("/auth/profile", {
        method: "PATCH", body: JSON.stringify({
          name: form.name.trim(), dept: form.dept, phone: form.phone || null, title: form.title || null,
        })
      });
      setUser(u => ({ ...u, ...form }));
      setOpenModal(null);
      toast("Profile updated", "success");
    } catch (e) {
      toast(e.message || "Failed to update profile", "error");
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
        window.PROGS = ["All Programmes", ...value];
      }
      toast(`Updated ${field}`, "success");
    } catch (e) { toast(e.message, "error"); }
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

  const iSm = { width: "100%", padding: "9px 12px", background: t.inputBg, border: "1px solid " + t.border2, borderRadius: 8, color: t.text, fontSize: 13 };

  function SettingsModal({ title, icon, children, width = 540 }) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        onClick={e => e.target === e.currentTarget && closeModal()}>
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
    { id: "profile", icon: IC.user, label: "Advisor Profile", sub: user?.name || "Update name, photo, department" },
    { id: "academic", icon: IC.calendar, label: "Academic Period", sub: `${academicYear || "2024/2025"} · ${semester || "Semester 2"}` },
    { id: "programmes", icon: IC.folder, label: "Programmes of Study", sub: `${programmesList.length} programmes configured` },
    { id: "appearance", icon: IC.sun, label: "Appearance", sub: dark ? "Dark mode is on" : "Light mode is on" },
    { id: "password", icon: IC.lock, label: "Change Password", sub: "Update your sign-in credentials" },
    { id: "thresholds", icon: IC.analytics, label: "Risk Thresholds", sub: `High ≥${thresh.high}% · Moderate ≥${thresh.mod}%` },
    { id: "notifications", icon: IC.alert, label: "Notifications", sub: "Alert preferences" },
    { id: "activity", icon: IC.activity, label: "Recent Activity", sub: `${activityLog.length} events this session` },
  ];

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", background: t.bg }}>
      {/* Modals */}
      {openModal === "profile" && (
        <SettingsModal title="Advisor Profile" icon={IC.user} width={560}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {user?.photo ? (
                <img src={user.photo} alt="Profile" style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "2px solid " + t.border2 }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 16, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "white", border: "2px solid " + t.accentMuted }}>
                  {(user?.name || "AD").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}
              <button onClick={() => imgRef.current.click()} title="Change photo" style={{ position: "absolute", bottom: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: t.accent, border: "2px solid " + t.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Icon ic={IC.camera} size={11} color="white" />
              </button>
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
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4 }}>PHONE (optional)</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={iSm} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={saveProfile} disabled={savingProfile} style={{ padding: "9px 20px", background: savingProfile ? t.border2 : t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: savingProfile ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  {savingProfile ? <><Spinner size={14} color="white" /> Saving...</> : <><Icon ic={IC.check} size={14} color="white" /> Save Changes</>}
                </button>
                <button onClick={() => { setForm({ title: user?.title || "", name: user?.name || "", email: user?.email || "", dept: user?.dept || "", phone: user?.phone || "" }); closeModal(); }} style={{ padding: "9px 16px", background: "none", border: "1px solid " + t.border2, borderRadius: 8, color: t.textSub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid " + t.border, paddingTop: 14, display: "flex", gap: 8 }}>
            {students.length > 0 && <button onClick={() => { closeModal(); onClear(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: t.warnBg, border: "1px solid " + t.warnMuted, borderRadius: 8, color: t.warn, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.trash} size={14} color={t.warn} /> Clear All Data</button>}
            <button onClick={() => { closeModal(); onLogout(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: t.dangerBg, border: "1px solid " + t.dangerMuted, borderRadius: 8, color: t.danger, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon ic={IC.logout} size={14} color={t.danger} /> Sign Out</button>
          </div>
        </SettingsModal>
      )}

      {openModal === "academic" && (
        <SettingsModal title="Academic Period" icon={IC.calendar} width={460}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Academic Year</label><input value={academicYear} onChange={e => updateMetadata("academic_year", e.target.value)} style={iSm} placeholder="e.g. 2024/2025" /></div>
            <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 5 }}>Semester</label><select value={semester} onChange={e => updateMetadata("semester", e.target.value)} style={{ ...iSm, cursor: "pointer" }}>{["Semester 1","Semester 2","Semester 3","Summer"].map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 12, color: t.muted, padding: "10px 14px", background: t.surface2, borderRadius: 8, border: "1px solid " + t.border }}>These values update the header shown across all pages and in printed reports. Changes save immediately.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button></div>
        </SettingsModal>
      )}

      {openModal === "programmes" && (
        <SettingsModal title="Programmes of Study" icon={IC.folder} width={480}>
          <div style={{ marginBottom: 16 }}>
            {programmesList.map(prog => (
              <div key={prog} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + t.border }}>
                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{prog}</span>
                <button onClick={() => removeProgramme(prog)} style={{ background: "none", border: "none", color: t.danger, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon ic={IC.trash} size={14} color={t.danger} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newProgramme} onChange={e => setNewProgramme(e.target.value)} onKeyDown={e => e.key === "Enter" && addProgramme()} placeholder="New programme name..." style={{ flex: 1, ...iSm }} />
            <button onClick={addProgramme} disabled={updatingMeta} style={{ padding: "9px 16px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ fontSize: 12, color: t.muted }}>These programmes appear in all dropdowns across the system.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button></div>
        </SettingsModal>
      )}

      {openModal === "appearance" && (
        <SettingsModal title="Appearance" icon={IC.sun} width={400}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" }}>
            <div><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Dark Mode</div><div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>Switch between light and dark interface</div></div>
            <Toggle on={dark} toggle={() => setDark(d => !d)} t={t} />
          </div>
          <div style={{ fontSize: 12, color: t.muted, padding: "10px 14px", background: t.surface2, borderRadius: 8, border: "1px solid " + t.border, marginTop: 8 }}>Your preference is saved locally in this browser session.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button></div>
        </SettingsModal>
      )}

      {openModal === "password" && (
        <SettingsModal title="Change Password" icon={IC.lock} width={420}>
          <ChangePasswordForm onDone={closeModal} />
        </SettingsModal>
      )}

      {openModal === "thresholds" && (
        <SettingsModal title="Risk Thresholds" icon={IC.analytics} width={520}>
          <div style={{ fontSize: 13, color: t.muted, marginBottom: 20 }}>Drag the sliders — all badges and colours update instantly across the entire app.</div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 14, borderRadius: 8, overflow: "hidden", position: "relative", background: `linear-gradient(to right, ${t.safe}, ${t.warn}, ${t.danger})`, marginBottom: 10 }}>
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
                  <input type="number" min={10} max={90} value={thresh[k]} onChange={e => setThresh(p => ({ ...p, [k]: Math.min(90, Math.max(10, +e.target.value || 10)) }))} style={{ width: 56, padding: "5px 8px", background: t.inputBg, border: "1.5px solid " + col, borderRadius: 7, color: col, fontSize: 14, fontWeight: 800, textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: col, fontWeight: 700 }}>%</span>
                </div>
              </div>
              <input type="range" min={10} max={90} value={thresh[k]} onChange={e => setThresh(p => ({ ...p, [k]: +e.target.value }))} style={{ width: "100%", accentColor: col, height: 6, cursor: "pointer" }} />
            </div>
          ))}
          <div style={{ padding: "14px 16px", background: t.surface2, borderRadius: 10, border: "1px solid " + t.border, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Live preview</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {[thresh.mod / 2, (thresh.mod + thresh.high) / 2, (thresh.high + 100) / 2].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><Badge risk={r / 100} sm /><span style={{ fontSize: 11, color: t.muted }}>{Math.round(r)}%</span></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button></div>
        </SettingsModal>
      )}

      {openModal === "notifications" && (
        <SettingsModal title="Notifications" icon={IC.alert} width={460}>
          {[{ k: "email", l: "Email alerts for high-risk students", sub: "Notified when a student crosses the high-risk threshold" }, { k: "weekly", l: "Weekly cohort summary", sub: "Every Monday morning" }, { k: "critical", l: "Instant critical alerts", sub: "Push notification for critical cases" }].map(({ k, l, sub }, i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < arr.length - 1 ? 18 : 0, marginBottom: i < arr.length - 1 ? 18 : 0, borderBottom: i < arr.length - 1 ? "1px solid " + t.border : "none" }}>
              <div><div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{l}</div><div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</div></div>
              <Toggle on={notifs[k]} toggle={() => setNotifs(n => ({ ...n, [k]: !n[k] }))} t={t} />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button onClick={closeModal} style={{ padding: "9px 22px", background: t.accent, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done</button></div>
        </SettingsModal>
      )}

      {openModal === "activity" && (
        <SettingsModal title="Recent Activity" icon={IC.activity} width={540}>
          {activityLog.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: t.muted, fontSize: 13 }}>No activity recorded this session yet.</div>
          ) : (
            activityLog.slice(0, 20).map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < Math.min(activityLog.length, 20) - 1 ? "1px solid " + t.border : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: ev.type === "risk" ? t.dangerBg : ev.type === "import" ? t.accentBg : ev.type === "intervention" ? t.safeBg : t.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon ic={ev.type === "risk" ? IC.alert : ev.type === "import" ? IC.upload : ev.type === "intervention" ? IC.note : IC.activity} size={14} color={ev.type === "risk" ? t.danger : ev.type === "import" ? t.accent : ev.type === "intervention" ? t.safe : t.muted} />
                </div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>{ev.msg}</div><div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{ev.time}</div></div>
              </div>
            ))
          )}
        </SettingsModal>
      )}

      <div style={{ maxWidth: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: t.surface, border: "1px solid " + t.border, borderRadius: 14, marginBottom: 24, boxShadow: t.shadow }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {user?.photo ? (
              <img src={user.photo} alt="Profile" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", border: "2px solid " + t.border2 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 14, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "white" }}>
                {(user?.name || "AD").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{user?.name || "Academic Advisor"}</div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{user?.email || "advisor@uenr.edu.gh"} · {user?.dept || "Faculty of Sciences"}</div>
            <div style={{ marginTop: 6, display: "inline-flex", padding: "2px 10px", background: t.safeBg, border: "1px solid " + t.safeMuted, borderRadius: 20, fontSize: 11, fontWeight: 600, color: t.safe }}>{user?.role === "admin" ? "Admin" : "Advisor"}</div>
          </div>
          <button onClick={() => setOpenModal("profile")} style={{ padding: "8px 16px", background: t.accentBg, border: "1px solid " + t.accentMuted, borderRadius: 9, color: t.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon ic={IC.edit} size={13} color={t.accent} /> Edit Profile
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {SECTIONS.map(({ id, icon, label, sub }) => (
            <button key={id} onClick={() => setOpenModal(id)}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                background: t.surface, border: "1px solid " + t.border, borderRadius: 12,
                cursor: "pointer", textAlign: "left", boxShadow: t.shadow, transition: "all .15s", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadow; e.currentTarget.style.transform = "none"; }}
            >
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