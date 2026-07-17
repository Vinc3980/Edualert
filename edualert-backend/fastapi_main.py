"""
EduAlert — FastAPI Backend (main.py)
=====================================
Place this file in:  edualert-backend/main.py

Run locally:
    uvicorn main:app --reload --port 8000

Then visit:  http://localhost:8000/docs  (interactive Swagger UI)

Folder structure required:
    edualert-backend/
    ├── main.py               ← this file
    ├── db.py                 ← MongoDB connection
    ├── .env                  ← environment variables (never commit this)
    ├── requirements.txt
    └── model_artifacts/
        ├── model.pkl
        ├── scaler.pkl
        ├── feature_names.pkl
        └── label_encoder.pkl
"""

import os, logging, html
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional, List, Tuple

import numpy as np
import joblib
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from jose import JWTError, jwt
from passlib.context import CryptContext

from db import (
    students_col, users_col, predictions_col, metadata_col,
    create_indexes
)

# ── Environment ────────────────────────────────────────────────────────────────
load_dotenv()

SECRET_KEY     = os.getenv("SECRET_KEY", "CHANGE-THIS-IN-PRODUCTION-use-a-long-random-string")
ALGORITHM      = "HS256"
TOKEN_EXPIRE_H = 8
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
MODEL_DIR      = os.getenv("MODEL_DIR", "model_artifacts")
SENDGRID_KEY   = os.getenv("SENDGRID_API_KEY", "")
EMAIL_FROM     = os.getenv("FROM_EMAIL", "vincent.korang.stu@uenr.edu.gh")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("edualert")

# ── SendGrid email helper (improved error reporting) ──────────────────────────
import secrets, string

def _send_email(to: str, subject: str, html_body: str) -> Tuple[bool, str]:
    """
    Returns (success: bool, error_message: str)
    """
    if not SENDGRID_KEY:
        log.warning(f"SendGrid not configured — email to {to} suppressed. Set SENDGRID_API_KEY in .env")
        return False, "SendGrid API key not configured"
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=EMAIL_FROM,
            to_emails=to,
            subject=subject,
            html_content=html_body,
        )
        sg = SendGridAPIClient(SENDGRID_KEY)
        resp = sg.send(msg)
        log.info(f"Email sent to {to} — status {resp.status_code}")
        if resp.status_code in (200, 202):
            return True, ""
        else:
            # Try to extract error details from response body
            error_detail = f"SendGrid returned {resp.status_code}"
            try:
                body = resp.body.decode() if isinstance(resp.body, bytes) else str(resp.body)
                error_detail += f": {body}"
            except:
                pass
            log.error(f"SendGrid error: {error_detail}")
            return False, error_detail
    except Exception as e:
        error_msg = str(e)
        log.error(f"SendGrid exception: {error_msg}")
        return False, f"SendGrid exception: {error_msg}"

def _make_reset_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))

def _reset_email_html(name: str, code: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:#2563EB;padding:20px 28px;border-radius:10px 10px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">EduAlert — Password Reset</h1>
        <p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:13px">
          University of Energy and Natural Resources
        </p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                  border-radius:0 0 10px 10px;padding:28px">
        <p style="color:#344054;font-size:14px">Hi {name},</p>
        <p style="color:#344054;font-size:14px;line-height:1.6">
          We received a request to reset your EduAlert password.
          Use the code below — it expires in <strong>15 minutes</strong>.
        </p>
        <div style="background:white;border:2px solid #2563EB;border-radius:10px;
                    padding:20px;text-align:center;margin:24px 0">
          <div style="font-size:36px;font-weight:800;letter-spacing:12px;color:#1e3a8a">
            {code}
          </div>
          <p style="color:#667085;font-size:12px;margin:8px 0 0">
            This code is valid for 15 minutes only.
          </p>
        </div>
        <p style="color:#667085;font-size:12px;line-height:1.6">
          If you did not request a password reset, you can safely ignore this email.
          Your password will not change.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#98a2b3;font-size:11px;margin:0">
          EduAlert · UENR Group 27 Final Year Project 2026
        </p>
      </div>
    </div>
    """

def _login_email_html(name: str, code: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:#14532D;padding:20px 28px;border-radius:10px 10px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">EduAlert Sign-In Code</h1>
        <p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:13px">
          University of Energy and Natural Resources
        </p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                  border-radius:0 0 10px 10px;padding:28px">
        <p style="color:#344054;font-size:14px">Hi {name},</p>
        <p style="color:#344054;font-size:14px;line-height:1.6">
          Use this code to finish signing in to EduAlert. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:white;border:2px solid #14532D;border-radius:10px;
                    padding:20px;text-align:center;margin:24px 0">
          <div style="font-size:36px;font-weight:800;letter-spacing:12px;color:#14532D">
            {code}
          </div>
          <p style="color:#667085;font-size:12px;margin:8px 0 0">
            This code is valid for one sign-in only.
          </p>
        </div>
        <p style="color:#667085;font-size:12px;line-height:1.6">
          If you did not try to sign in, change your EduAlert password or contact the system administrator.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#98a2b3;font-size:11px;margin:0">
          EduAlert Â· UENR Group 27 Final Year Project 2026
        </p>
      </div>
    </div>
    """

def _student_alert_email_html(student_name: str, student_id: str, risk_score: float, programme: str, advisor_name: str) -> str:
    level = "High Risk" if risk_score >= 0.70 else "Moderate Risk"
    colour = "#DC2626" if risk_score >= 0.70 else "#B45309"
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:#2563EB;padding:20px 28px;border-radius:10px 10px 0 0">
        <h1 style="color:white;margin:0;font-size:18px">EduAlert — Academic Support Notification</h1>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                  border-radius:0 0 10px 10px;padding:28px">
        <p style="color:#344054;font-size:14px">Dear {student_name},</p>
        <p style="color:#344054;font-size:14px;line-height:1.6">
          Your academic advisor, <strong>{advisor_name}</strong>, has been notified that the EduAlert system has flagged your academic profile for attention.
        </p>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;
                    padding:16px;margin:16px 0">
          <div style="font-size:16px;font-weight:700;color:#101828">{student_name}</div>
          <div style="font-size:13px;color:#667085;margin-top:2px">{student_id} · {programme}</div>
          <div style="margin-top:12px;display:inline-block;padding:6px 14px;
                      background:{colour}15;border:1px solid {colour}40;
                      border-radius:6px;font-size:14px;font-weight:700;color:{colour}">
            {level} — {round(risk_score * 100)}% dropout risk
          </div>
        </div>
        <p style="color:#344054;font-size:13px;line-height:1.6">
          Please contact your academic advisor, {advisor_name}, to discuss support options and next steps.
          There are resources available to help you succeed.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#98a2b3;font-size:11px">
          EduAlert · UENR Group 27 Final Year Project 2026
        </p>
      </div>
    </div>
    """

def _custom_student_email_html(student_name: str, student_id: str, programme: str, risk_score: float, message: str) -> str:
    level = "High Risk" if risk_score >= 0.70 else "Moderate Risk" if risk_score >= 0.40 else "Low Risk"
    colour = "#DC2626" if risk_score >= 0.70 else "#B45309" if risk_score >= 0.40 else "#059669"
    safe_message = html.escape(message or "").replace("\n", "<br/>")
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px">
      <div style="background:#14532D;padding:20px 28px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:18px">EduAlert — Academic Support Message</h1>
        <p style="color:rgba(255,255,255,.78);margin:6px 0 0;font-size:12px">University of Energy and Natural Resources</p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px">
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:18px">
          <div style="font-size:16px;font-weight:700;color:#101828">{html.escape(student_name)}</div>
          <div style="font-size:13px;color:#667085;margin-top:2px">{html.escape(student_id)} · {html.escape(programme)}</div>
          <div style="margin-top:12px;display:inline-block;padding:6px 14px;background:{colour}15;border:1px solid {colour}40;border-radius:999px;font-size:13px;font-weight:700;color:{colour}">
            {level} — {round(risk_score * 100)}% dropout risk
          </div>
        </div>
        <div style="color:#344054;font-size:14px;line-height:1.7">{safe_message}</div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0"/>
        <p style="color:#98a2b3;font-size:11px;margin:0">EduAlert · UENR Group 27 Final Year Project 2026</p>
      </div>
    </div>
    """

def _advisor_alert_email_html(advisor_name: str, student_name: str, student_id: str, risk_score: float, programme: str) -> str:
    level = "High Risk" if risk_score >= 0.70 else "Moderate Risk"
    colour = "#DC2626" if risk_score >= 0.70 else "#B45309"
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:#2563EB;padding:20px 28px;border-radius:10px 10px 0 0">
        <h1 style="color:white;margin:0;font-size:18px">EduAlert — Student Risk Alert</h1>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                  border-radius:0 0 10px 10px;padding:28px">
        <p style="color:#344054;font-size:14px">Dear {advisor_name},</p>
        <p style="color:#344054;font-size:14px;line-height:1.6">
          The EduAlert system has flagged the following student as requiring your attention:
        </p>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;
                    padding:16px;margin:16px 0">
          <div style="font-size:16px;font-weight:700;color:#101828">{student_name}</div>
          <div style="font-size:13px;color:#667085;margin-top:2px">{student_id} · {programme}</div>
          <div style="margin-top:12px;display:inline-block;padding:6px 14px;
                      background:{colour}15;border:1px solid {colour}40;
                      border-radius:6px;font-size:14px;font-weight:700;color:{colour}">
            {level} — {round(risk_score * 100)}% dropout risk
          </div>
        </div>
        <p style="color:#344054;font-size:13px;line-height:1.6">
          Please log in to EduAlert to view the full risk explanation and
          recommended intervention actions for this student.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="color:#98a2b3;font-size:11px">
          EduAlert · UENR Group 27 Final Year Project 2026 ·
          This alert was generated automatically.
        </p>
      </div>
    </div>
    """

# ── Load ML model at startup ───────────────────────────────────────────────────
try:
    model        = joblib.load(f"{MODEL_DIR}/model.pkl")
    scaler       = joblib.load(f"{MODEL_DIR}/scaler.pkl")
    feature_cols = joblib.load(f"{MODEL_DIR}/feature_names.pkl")
    le           = joblib.load(f"{MODEL_DIR}/label_encoder.pkl")
    log.info(f"✓ ML model loaded  ({len(feature_cols)} features)")
except Exception as e:
    log.error(f"✗ Could not load model: {e}")
    log.error("  Make sure model_artifacts/ folder exists with all 4 .pkl files")
    model = scaler = feature_cols = le = None

# ── App lifecycle ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_indexes()
    # Ensure default metadata exists
    meta = await metadata_col.find_one({"_id": "system"})
    if not meta:
        await metadata_col.insert_one({
            "_id": "system",
            "academic_year": "2024/2025",
            "semester": "Semester 2",
            "programmes": ["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"]
        })
    log.info("✓ MongoDB indexes ready")
    yield
    log.info("Server shutting down")

app = FastAPI(
    title="EduAlert API",
    description="Student Dropout Risk Prediction System — UENR Group 27",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth helpers ───────────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2  = OAuth2PasswordBearer(tokenUrl="/auth/login")

def create_access_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_H), "type": "access"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS), "type": "refresh"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

def advisor_scope(user: dict) -> dict:
    return {"advisor_email": user.get("sub")}

def scoped_student_query(user: dict, student_id: Optional[str] = None) -> dict:
    query = advisor_scope(user)
    if student_id is not None:
        query["student_id"] = student_id
    return query

# ── Pydantic schemas ───────────────────────────────────────────────────────────

class StudentIn(BaseModel):
    student_id:      str
    name:            str
    programme:       str
    level:           int = Field(ge=100, le=400)
    semester:        int = Field(ge=1, le=2)
    gpa:             float = Field(ge=0.0, le=4.0)
    attendance:      float = Field(ge=0.0, le=100.0)
    credits:         float
    required:        float
    failed_modules:  int   = 0
    financial_flag:  int   = 0
    repeated_course: int   = 0
    probation:       int   = 0

class InterventionIn(BaseModel):
    note: str
    by:   str = "Advisor"

class UserCreate(BaseModel):
    email:    str
    password: str
    name:     str
    role:     str = "advisor"   # only 'advisor' allowed for normal signup

class UserUpdate(BaseModel):
    name:  Optional[str] = None
    dept:  Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None
    title: Optional[str] = None
    staff_id: Optional[str] = None
    office: Optional[str] = None
    faculty: Optional[str] = None
    consultation_hours: Optional[str] = None
    bio: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email:    str
    code:     str
    password: str

class LoginVerificationRequest(BaseModel):
    email: str
    code:  str

class SendAlertRequest(BaseModel):
    student_id:   str
    student_name: str
    programme:    str
    risk_score:   float
    student_email: Optional[str] = None
    message: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class MetadataUpdate(BaseModel):
    academic_year: Optional[str] = None
    semester:      Optional[str] = None
    programmes:    Optional[List[str]] = None

# ── Feature builder ────────────────────────────────────────────────────────────
def build_feature_vector(s: StudentIn) -> np.ndarray:
    if model is None:
        raise HTTPException(status_code=503, detail="ML model not loaded")

    cr  = s.credits / max(s.required, 1)
    gpa = s.gpa
    att = s.attendance

    row = {col: 0.0 for col in feature_cols}

    row["gpa"]             = gpa
    row["attendance"]      = att
    row["credit_ratio"]    = cr
    row["failed_modules"]  = float(s.failed_modules)
    row["gpa_norm"]        = gpa / 4.0
    row["att_norm"]        = att / 100.0
    row["risk_composite"]  = (1 - gpa/4.0)*0.40 + (1 - att/100.0)*0.30 + (1 - cr)*0.30
    row["financial_flag"]  = float(s.financial_flag)
    row["repeated_course"] = float(s.repeated_course)
    row["probation"]       = float(s.probation)
    row["level"]           = float(s.level)
    row["semester"]        = float(s.semester)

    try:
        row["programme_enc"] = float(le.transform([s.programme])[0])
    except Exception:
        row["programme_enc"] = 0.0

    return np.array([[row[c] for c in feature_cols]])

def risk_label(score: float) -> str:
    return "High Risk" if score >= 0.70 else "Moderate" if score >= 0.40 else "Low Risk"

def build_shap_proxy(gpa, att, cr, prog, sem) -> list:
    return [
        {"f": "GPA level",          "v": round((1 - gpa/4.0)*0.4 - 0.10, 3)},
        {"f": "Attendance rate",    "v": round((1 - att/100.0)*0.3 - 0.08, 3)},
        {"f": "Credit completion",  "v": round((1 - cr)*0.25 - 0.07, 3)},
        {"f": "Semester stage",     "v": -0.05 if sem == 1 else 0.03},
        {"f": "Programme factor",   "v": 0.06 if prog == "Mech. Engineering" else -0.03},
    ]

# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

# ── Health & System ────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/model/info", tags=["System"])
async def model_info():
    return {
        "version": "1.0.0",
        "features": feature_cols,
        "programmes": await get_programmes(),
        "thresholds": {"high_risk": 0.70, "moderate_risk": 0.40},
    }

@app.get("/model/performance", tags=["System"])
async def model_performance():
    return {
        "auc": 0.9606,
        "accuracy": 0.91,
        "precision": 0.89,
        "recall": 0.93,
        "f1": 0.91,
        "threshold": 0.5
    }

# ── Metadata (Academic Year, Semester, Programmes) ─────────────────────────────
async def get_programmes() -> List[str]:
    meta = await metadata_col.find_one({"_id": "system"})
    if meta and "programmes" in meta:
        return meta["programmes"]
    return ["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"]

@app.get("/metadata", tags=["System"])
async def get_metadata():
    meta = await metadata_col.find_one({"_id": "system"})
    if not meta:
        return {
            "academic_year": "2024/2025",
            "semester": "Semester 2",
            "programmes": ["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"]
        }
    return {
        "academic_year": meta.get("academic_year", "2024/2025"),
        "semester": meta.get("semester", "Semester 2"),
        "programmes": meta.get("programmes", ["Computer Science", "Electrical Eng.", "Business Admin.", "Mech. Engineering"])
    }

@app.post("/metadata", tags=["Admin"])
async def update_metadata(update: MetadataUpdate, admin: dict = Depends(get_current_admin)):
    """Update academic year, semester, or programme list (admin only)."""
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    await metadata_col.update_one({"_id": "system"}, {"$set": update_dict}, upsert=True)
    return {"message": "Metadata updated", "updated": list(update_dict.keys())}

# ── Authentication ─────────────────────────────────────────────────────────────
@app.post("/auth/login", tags=["Auth"])
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await users_col.find_one({"email": form.username})
    if not user or not pwd_ctx.verify(form.password, user["hashed_pw"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    code = _make_reset_code(6)
    expires = datetime.utcnow() + timedelta(minutes=10)
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "login_code": pwd_ctx.hash(code),
            "login_expires": expires,
        }},
    )
    success, error_msg = _send_email(
        to=user["email"],
        subject="EduAlert — Your Sign-In Verification Code",
        html_body=_login_email_html(user.get("name", "Advisor"), code),
    )
    if success:
        log.info(f"Login verification code sent to {user['email']}")
    else:
        log.warning(f"[DEMO] Login code for {user['email']}: {code} (email failed: {error_msg})")
    return {"message": "Verification code sent."}

@app.post("/auth/verify-login", tags=["Auth"])
async def verify_login(payload: LoginVerificationRequest):
    user = await users_col.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification request")

    login_code = user.get("login_code")
    login_expires = user.get("login_expires")
    if not login_code or not login_expires:
        raise HTTPException(status_code=400, detail="No sign-in code found. Request a new code.")
    if datetime.utcnow() > login_expires:
        raise HTTPException(status_code=400, detail="Sign-in code has expired. Request a new code.")
    if not pwd_ctx.verify(payload.code, login_code):
        raise HTTPException(status_code=400, detail="Incorrect verification code")

    access_token = create_access_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    refresh_token = create_refresh_token({"sub": user["email"]})
    await users_col.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"refresh_token_hash": pwd_ctx.hash(refresh_token)},
            "$unset": {"login_code": "", "login_expires": ""},
        },
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type":   "bearer",
        "user": {
            "email": user["email"],
            "name":  user["name"],
            "role":  user["role"],
            "title": user.get("title", ""),
            "dept":  user.get("dept", ""),
            "phone": user.get("phone", ""),
            "photo": user.get("photo", ""),
        },
    }

@app.post("/auth/refresh", tags=["Auth"])
async def refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user = await users_col.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token({"sub": email, "role": user["role"], "name": user["name"]})
        return {"access_token": new_access, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.post("/auth/register", tags=["Auth"])
async def register(payload: UserCreate):
    """Only advisor accounts can be created via this endpoint."""
    if payload.role != "advisor":
        raise HTTPException(status_code=400, detail="Only 'advisor' role can be created via registration. Admin accounts must be created via seed_db.py.")
    existing = await users_col.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    await users_col.insert_one({
        "email":     payload.email,
        "hashed_pw": pwd_ctx.hash(payload.password),
        "name":      payload.name,
        "role":      payload.role,
        "created":   datetime.utcnow(),
    })
    return {"message": f"Account created for {payload.email}"}

@app.post("/auth/forgot-password", tags=["Auth"])
async def forgot_password(payload: ForgotPasswordRequest):
    user = await users_col.find_one({"email": payload.email})
    if user:
        code     = _make_reset_code(6)
        expires  = datetime.utcnow() + timedelta(minutes=15)
        await users_col.update_one(
            {"email": payload.email},
            {"$set": {
                "reset_code":    pwd_ctx.hash(code),
                "reset_expires": expires,
            }},
        )
        success, error_msg = _send_email(
            to=payload.email,
            subject="EduAlert — Your Password Reset Code",
            html_body=_reset_email_html(user.get("name", "Advisor"), code),
        )
        if success:
            log.info(f"Reset code sent to {payload.email}")
        else:
            log.warning(f"[DEMO] Reset code for {payload.email}: {code} (email failed: {error_msg})")
    return {"message": "If that email is registered, a reset code has been sent."}

@app.post("/auth/reset-password", tags=["Auth"])
async def reset_password(payload: ResetPasswordRequest):
    user = await users_col.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    reset_code    = user.get("reset_code")
    reset_expires = user.get("reset_expires")

    if not reset_code or not reset_expires:
        raise HTTPException(status_code=400, detail="No reset code found — request a new one")

    if datetime.utcnow() > reset_expires:
        raise HTTPException(status_code=400, detail="Reset code has expired — request a new one")

    if not pwd_ctx.verify(payload.code, reset_code):
        raise HTTPException(status_code=400, detail="Incorrect reset code")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    await users_col.update_one(
        {"email": payload.email},
        {"$set":   {"hashed_pw": pwd_ctx.hash(payload.password)},
         "$unset": {"reset_code": "", "reset_expires": ""}},
    )
    return {"message": "Password updated successfully. Please sign in with your new password."}

@app.post("/auth/change-password", tags=["Auth"])
async def change_password(payload: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    user = await users_col.find_one({"email": current_user["sub"]})
    if not user or not pwd_ctx.verify(payload.current_password, user["hashed_pw"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    await users_col.update_one(
        {"email": current_user["sub"]},
        {"$set": {"hashed_pw": pwd_ctx.hash(payload.new_password)}}
    )
    return {"message": "Password changed successfully"}

@app.patch("/auth/profile", tags=["Auth"])
async def update_profile(payload: UserUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return {"message": "Nothing to update"}
    updates["updated"] = datetime.utcnow()
    result = await users_col.update_one(
        {"email": user["sub"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Profile updated", "updated_fields": list(updates.keys())}

@app.get("/auth/me", tags=["Auth"])
async def get_me(user: dict = Depends(get_current_user)):
    doc = await users_col.find_one({"email": user["sub"]}, {"_id": 0, "hashed_pw": 0, "reset_code": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return doc

# ── Notifications (improved error reporting) ───────────────────────────────────
@app.post("/notifications/alert", tags=["Notifications"])
async def send_student_alert(payload: SendAlertRequest, user: dict = Depends(get_current_user)):
    advisor_doc = await users_col.find_one({"email": user["sub"]})
    advisor_name = advisor_doc.get("name", "Advisor") if advisor_doc else "Advisor"
    
    # Determine recipient and email content
    if payload.student_email:
        recipient = payload.student_email
        subject = "EduAlert — Academic Support Notification"
        html_body = _custom_student_email_html(
            student_name=payload.student_name,
            student_id=payload.student_id,
            risk_score=payload.risk_score,
            programme=payload.programme,
            message=payload.message or (
                f"Dear {payload.student_name},\n\n"
                f"Your academic advisor, {advisor_name}, would like to schedule a meeting with you to discuss your academic progress and available support options.\n\n"
                "Please reply to this email to confirm a suitable time."
            ),
        )
    else:
        recipient = user["sub"]
        risk_level = "High Risk" if payload.risk_score >= 0.70 else "Moderate Risk"
        subject = f"EduAlert — {payload.student_name} flagged as {risk_level}"
        html_body = _advisor_alert_email_html(
            advisor_name=advisor_name,
            student_name=payload.student_name,
            student_id=payload.student_id,
            risk_score=payload.risk_score,
            programme=payload.programme,
        )
    
    # Send email and capture detailed result
    sent_success, error_msg = _send_email(to=recipient, subject=subject, html_body=html_body)
    
    # Log the attempt
    await predictions_col.insert_one({
        "type": "email_alert",
        "student_id": payload.student_id,
        "advisor_email": user.get("sub"),
        "sent_to": recipient,
        "risk_score": payload.risk_score,
        "timestamp": datetime.utcnow(),
        "sent_success": sent_success,
        "error_message": error_msg if not sent_success else None,
    })
    
    if sent_success:
        return {"sent": True, "message": f"Alert email sent to {recipient}"}
    else:
        # Return a user-friendly error message
        return {
            "sent": False,
            "message": f"Email failed: {error_msg or 'Unknown SendGrid error'}"
        }

# ── Prediction ─────────────────────────────────────────────────────────────────
@app.post("/predict", tags=["Prediction"])
async def predict(s: StudentIn, user: dict = Depends(get_current_user)):
    X          = build_feature_vector(s)
    risk_score = float(model.predict_proba(X)[0][1])
    cr         = s.credits / max(s.required, 1)
    shap       = build_shap_proxy(s.gpa, s.attendance, cr, s.programme, s.semester)

    label = risk_label(risk_score)
    rec   = (
        "Immediate intervention required. Schedule a counselling session within the next week."
        if risk_score >= 0.70 else
        "Proactive check-in recommended within two weeks. Monitor trends closely."
        if risk_score >= 0.40 else
        "Student appears on track. Continue standard monitoring."
    )

    await predictions_col.insert_one({
        "student_id":   s.student_id,
        "risk_score":   round(risk_score, 4),
        "risk_label":   label,
        "features":     {c: float(build_feature_vector(s)[0][i]) for i, c in enumerate(feature_cols)},
        "shap_values":  shap,
        "advisor_email": user.get("sub"),
        "model_version": "1.0.0",
        "timestamp":    datetime.utcnow(),
    })

    await students_col.update_one(
        scoped_student_query(user, s.student_id),
        {"$set": {**s.dict(), **advisor_scope(user), "risk_score": round(risk_score, 4), "risk_label": label,
                  "last_predicted": datetime.utcnow()}},
        upsert=True,
    )

    return {
        "risk_score":      round(risk_score, 4),
        "risk_label":      label,
        "recommendation":  rec,
        "shap_values":     shap,
        "model_version":   "1.0.0",
    }

@app.post("/predict/batch", tags=["Prediction"])
async def predict_batch(payload: dict, user: dict = Depends(get_current_user)):
    raw_students = payload.get("students", [])
    if not raw_students:
        raise HTTPException(status_code=400, detail="No students provided")

    results = []
    for raw in raw_students:
        try:
            s          = StudentIn(**raw)
            X          = build_feature_vector(s)
            risk_score = float(model.predict_proba(X)[0][1])
            cr         = s.credits / max(s.required, 1)
            label      = risk_label(risk_score)
            shap       = build_shap_proxy(s.gpa, s.attendance, cr, s.programme, s.semester)

            results.append({
                **raw,
                "risk_score":  round(risk_score, 4),
                "risk_label":  label,
                "shap_values": shap,
            })

            await students_col.update_one(
                scoped_student_query(user, s.student_id),
                {"$set": {**s.dict(), **advisor_scope(user), "risk_score": round(risk_score, 4),
                          "risk_label": label, "last_predicted": datetime.utcnow()}},
                upsert=True,
            )

        except Exception as e:
            log.warning(f"Skipped student {raw.get('student_id','?')}: {e}")
            continue

    results.sort(key=lambda x: -x["risk_score"])
    high = sum(1 for r in results if r["risk_score"] >= 0.70)
    mod  = sum(1 for r in results if 0.40 <= r["risk_score"] < 0.70)

    return {
        "total":    len(results),
        "high":     high,
        "moderate": mod,
        "low":      len(results) - high - mod,
        "students": results,
    }

# ── Students CRUD ──────────────────────────────────────────────────────────────
@app.get("/students", tags=["Students"])
async def get_students(
    programme: Optional[str] = None,
    risk_min:  Optional[float] = None,
    user: dict = Depends(get_current_user)
):
    query = advisor_scope(user)
    if programme:
        query["programme"] = programme
    if risk_min is not None:
        query["risk_score"] = {"$gte": risk_min}
    docs = await students_col.find(query, {"_id": 0}).sort("risk_score", -1).to_list(1000)
    return docs

@app.get("/students/{student_id:path}/interventions", tags=["Students"])
async def get_interventions(student_id: str, user: dict = Depends(get_current_user)):
    doc = await students_col.find_one(scoped_student_query(user, student_id), {"interventions": 1, "_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Student not found")
    return doc.get("interventions", [])

@app.get("/students/{student_id:path}", tags=["Students"])
async def get_student(student_id: str, user: dict = Depends(get_current_user)):
    doc = await students_col.find_one(scoped_student_query(user, student_id), {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Student not found")
    return doc

@app.post("/students", tags=["Students"])
async def upsert_student(s: StudentIn, user: dict = Depends(get_current_user)):
    await students_col.update_one(
        scoped_student_query(user, s.student_id),
        {"$set": {**s.dict(), **advisor_scope(user), "updated": datetime.utcnow()}},
        upsert=True,
    )
    return {"message": f"Student {s.student_id} saved"}

@app.post("/students/bulk", tags=["Students"])
async def bulk_import(payload: dict, user: dict = Depends(get_current_user)):
    students = payload.get("students", [])
    if not students:
        raise HTTPException(status_code=400, detail="No students provided")

    saved = 0
    for raw in students:
        try:
            s = StudentIn(**raw)
            await students_col.update_one(
                scoped_student_query(user, s.student_id),
                {"$set": {**s.dict(), **advisor_scope(user), "interventions": raw.get("interventions", []),
                          "updated": datetime.utcnow()}},
                upsert=True,
            )
            saved += 1
        except Exception as e:
            log.warning(f"Skipped import for {raw.get('student_id','?')}: {e}")

    return {"imported": saved, "total": len(students)}

@app.delete("/students/all", tags=["Students"])
async def delete_all_students(user: dict = Depends(get_current_user)):
    """
    Delete ALL student records from the database.
    Called when the advisor uses 'Clear Data' in the frontend.
    Requires authentication — any logged-in advisor or admin can do this.
    """
    result = await students_col.delete_many(advisor_scope(user))
    log.info(f"[{user.get('sub')}] Cleared all students — {result.deleted_count} records deleted")
    return {
        "message": "Your student records were cleared",
        "deleted": result.deleted_count,
    }

@app.delete("/students/{student_id:path}", tags=["Students"])
async def delete_student(student_id: str, user: dict = Depends(get_current_user)):
    result = await students_col.delete_one(scoped_student_query(user, student_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": f"Student {student_id} deleted"}

# ── Interventions ──────────────────────────────────────────────────────────────
@app.patch("/students/{student_id:path}/interventions", tags=["Students"])
async def add_intervention(
    student_id: str,
    note: InterventionIn,
    user: dict = Depends(get_current_user)
):
    doc = await students_col.find_one(scoped_student_query(user, student_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Student not found")

    entry = {
        "note":      note.note,
        "by":        note.by or user.get("name", "Advisor"),
        "date":      datetime.utcnow().strftime("%Y-%m-%d"),
        "timestamp": datetime.utcnow().isoformat(),
    }

    await students_col.update_one(
        scoped_student_query(user, student_id),
        {"$push": {"interventions": {"$each": [entry], "$position": 0}}},
    )
    return {"message": "Intervention saved", "entry": entry}

async def get_interventions_legacy(student_id: str, user: dict = Depends(get_current_user)):
    doc = await students_col.find_one(scoped_student_query(user, student_id), {"interventions": 1, "_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Student not found")
    return doc.get("interventions", [])

# ── Analytics ──────────────────────────────────────────────────────────────────
@app.get("/analytics/cohort", tags=["Analytics"])
async def cohort_summary(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": advisor_scope(user)},
        {"$group": {
            "_id":      "$programme",
            "count":    {"$sum": 1},
            "avg_risk": {"$avg": "$risk_score"},
            "high":     {"$sum": {"$cond": [{"$gte": ["$risk_score", 0.70]}, 1, 0]}},
            "moderate": {"$sum": {"$cond": [{"$and": [
                            {"$gte": ["$risk_score", 0.40]},
                            {"$lt":  ["$risk_score", 0.70]}]}, 1, 0]}},
        }},
        {"$sort": {"avg_risk": -1}},
    ]
    result = await students_col.aggregate(pipeline).to_list(20)
    return [
        {
            "programme": r["_id"],
            "count":     r["count"],
            "avg_risk":  round(r["avg_risk"] or 0, 4),
            "high":      r["high"],
            "moderate":  r["moderate"],
            "low":       r["count"] - r["high"] - r["moderate"],
        }
        for r in result
    ]

@app.get("/analytics/predictions-history", tags=["Analytics"])
async def predictions_history(days: int = 30, user: dict = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {**advisor_scope(user), "timestamp": {"$gte": since}}},
        {"$group": {
            "_id":      {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count":    {"$sum": 1},
            "avg_risk": {"$avg": "$risk_score"},
        }},
        {"$sort": {"_id": 1}},
    ]
    result = await predictions_col.aggregate(pipeline).to_list(days)
    return [{"date": r["_id"], "count": r["count"], "avg_risk": round(r["avg_risk"], 4)} for r in result]

# ── Audit Log (Admin only) ─────────────────────────────────────────────────────
@app.get("/audit-log", tags=["Admin"])
async def audit_log(limit: int = 100, admin: dict = Depends(get_current_admin)):
    cursor = predictions_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(limit)
    return logs

# ── Admin utility (protected) ──────────────────────────────────────────────────
@app.post("/admin/seed-advisor", tags=["Admin"])
async def seed_advisor(payload: UserCreate, admin: dict = Depends(get_current_admin)):
    """Only existing admins can create new admin accounts via this endpoint."""
    existing = await users_col.find_one({"email": payload.email})
    if existing:
        return {"message": "Email already exists — no action taken"}
    await users_col.insert_one({
        "email":     payload.email,
        "hashed_pw": pwd_ctx.hash(payload.password),
        "name":      payload.name,
        "role":      payload.role,
        "created":   datetime.utcnow(),
    })
    return {"message": f"Account created for {payload.email}"}
