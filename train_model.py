"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   EduAlert — Multi-Dataset Model Training Script                            ║
║   University of Energy and Natural Resources (UENR) · Group 27              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  DATASETS USED (all free and publicly available):                            ║
║                                                                              ║
║  1. UCI Student Performance (Cortez & Silva, 2008)                           ║
║     – 649 students, secondary school, Math & Portuguese grades              ║
║     – Columns: absences, G1, G2, G3, studytime, failures, etc.             ║
║     – Source: https://archive.ics.uci.edu/dataset/320/student+performance  ║
║                                                                              ║
║  2. UCI Predict Students Dropout and Academic Success (2022)                 ║
║     – 4,424 higher-education students, Polytechnic Institute of Portalegre  ║
║     – Columns: curricular units, GPA, tuition fees, scholarship, etc.      ║
║     – Source: https://archive.ics.uci.edu/dataset/697/predict+students     ║
║                                                                              ║
║  3. Open University Learning Analytics (OULAD, 2017)                        ║
║     – 32,593 students, 22 courses, VLE engagement, assessments              ║
║     – Source: https://analyse.kmi.open.ac.uk/open_dataset                  ║
║                                                                              ║
║  4. EduAlert Synthetic (UENR proxy)                                         ║
║     – 1,200 students matching UENR programme structure and credit system    ║
║     – Used as training bridge until real UENR records are available         ║
║                                                                              ║
║  COLUMN MAPPING APPROACH:                                                    ║
║     Each external dataset has different column names. This script maps      ║
║     all of them to EduAlert's 11 unified features before merging.           ║
║     Missing features are imputed with column medians, never dropped.        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  QUICK START:                                                                ║
║     pip install scikit-learn pandas numpy joblib requests                   ║
║     python train_model.py                        ← uses all 4 datasets     ║
║     python train_model.py --data my_data.csv     ← adds your real UENR data║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os, sys, json, time, argparse, warnings, io
warnings.filterwarnings("ignore")

import numpy  as np
import pandas as pd
import joblib

from sklearn.ensemble        import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model    import LogisticRegression
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing   import StandardScaler, LabelEncoder
from sklearn.metrics         import (classification_report, confusion_matrix,
                                     roc_auc_score, f1_score, accuracy_score,
                                     precision_score, recall_score)
from sklearn.calibration     import CalibratedClassifierCV

# ─── PATHS ────────────────────────────────────────────────────────────────────
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(SCRIPT_DIR, "model_artifacts")
DATA_DIR      = os.path.join(SCRIPT_DIR, "datasets")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

def ap(name): return os.path.join(ARTIFACTS_DIR, name)
def dp(name): return os.path.join(DATA_DIR, name)

# ─── CONFIG ───────────────────────────────────────────────────────────────────
RANDOM_SEED   = 42
TEST_SIZE     = 0.20
N_CV_FOLDS    = 5
N_SYNTHETIC   = 1200

PROGRAMMES    = ["Computer Science","Electrical Eng.","Business Admin.","Mech. Engineering"]
UNIFIED_COLS  = ["gpa","attendance","credit_ratio","failed_modules",
                 "gpa_norm","att_norm","risk_composite",
                 "financial_flag","repeated_course","probation",
                 "level","semester","programme_enc","dropout"]

# ─── PRINT HELPERS ────────────────────────────────────────────────────────────
def banner(txt, w=72): print("\n"+"═"*w+f"\n  {txt}\n"+"═"*w)
def section(txt):       print(f"\n── {txt} "+"─"*max(0,56-len(txt)))

# ══════════════════════════════════════════════════════════════════════════════
# DATASET 1 — UCI Student Performance (Cortez & Silva 2008)
# ══════════════════════════════════════════════════════════════════════════════
def load_uci_student_performance():
    """
    UCI Student Performance dataset.
    Two CSV files: student-mat.csv (Math) and student-por.csv (Portuguese).
    We merge both, map columns to EduAlert features, and label students who
    failed (final grade G3 < 10 out of 20) as dropout=1.

    Column mapping:
      absences     → attendance (inverted: more absences = lower attendance %)
      G3           → gpa (scaled 0-4: G3/20 * 4)
      failures     → failed_modules
      Pstatus=='T' → financial_flag proxy (parents living apart = more stress)
      famsup       → repeated_course proxy
      G1/G3 slope  → risk_composite proxy
    """
    section("Dataset 1: UCI Student Performance")

    URL_MAT = "https://archive.ics.uci.edu/ml/machine-learning-databases/00320/student.zip"
    local   = dp("student_performance.csv")

    # Try to load from local cache first
    if os.path.exists(local):
        print(f"  Loading from cache: {local}")
        df = pd.read_csv(local)
    else:
        # Attempt download
        try:
            import requests, zipfile
            print("  Downloading UCI Student Performance dataset…")
            r = requests.get(URL_MAT, timeout=30)
            if r.status_code == 200:
                z = zipfile.ZipFile(io.BytesIO(r.content))
                frames = []
                for name in z.namelist():
                    if name.endswith(".csv") and "student" in name.lower():
                        raw = z.read(name).decode("utf-8")
                        f   = pd.read_csv(io.StringIO(raw), sep=";")
                        frames.append(f)
                if frames:
                    df = pd.concat(frames, ignore_index=True)
                    df.to_csv(local, index=False)
                    print(f"  ✓ Downloaded and cached {len(df)} rows")
                else:
                    raise ValueError("No CSV files found in ZIP")
            else:
                raise ConnectionError(f"HTTP {r.status_code}")
        except Exception as e:
            print(f"  ⚠ Could not download ({e}). Generating proxy data instead.")
            return _proxy_uci_student(800)

    return _map_uci_student(df)


def _map_uci_student(df):
    """Map UCI Student Performance columns → EduAlert unified columns."""
    df = df.copy()
    df.columns = [c.lower().strip() for c in df.columns]

    # GPA: G3 is 0-20, convert to 0-4 scale
    if "g3" in df.columns:
        df["gpa_ea"]   = (df["g3"] / 20.0) * 4.0
        df["dropout"]  = (df["g3"] < 10).astype(int)
    else:
        return pd.DataFrame()  # cannot map without G3

    # Attendance: absences range 0-93; map to %: 100 - min(absences/93*100, 90)
    if "absences" in df.columns:
        df["att_ea"] = 100 - np.clip(df["absences"] / 93.0 * 100, 0, 85)
    else:
        df["att_ea"] = 80.0

    # Failed modules (0-3 in dataset)
    df["fail_ea"] = df.get("failures", pd.Series(0, index=df.index)).clip(0, 4)

    # Financial proxy: Pstatus T = parents apart, often correlates with hardship
    df["fin_ea"]  = (df.get("pstatus", "").str.upper() == "T").astype(int)

    # Repeated course proxy: if student failed any module before
    df["rep_ea"]  = (df["fail_ea"] > 0).astype(int)

    # Probation proxy: G1 (first period grade) < 10
    if "g1" in df.columns:
        df["prob_ea"] = (df["g1"] < 10).astype(int)
    else:
        df["prob_ea"] = 0

    # Credit ratio: use studytime as proxy (1-4 scale → 0.3–1.0)
    df["cr_ea"] = df.get("studytime", pd.Series(2, index=df.index)).clip(1, 4) / 4.0

    # Level and semester: not directly available; use "school year" proxy
    df["level_ea"]    = 200  # secondary = roughly level 200
    df["semester_ea"] = 1

    # Programme: not available; assign evenly
    df["prog_ea"] = np.random.choice(PROGRAMMES, size=len(df))

    out = _build_unified(df, "gpa_ea", "att_ea", "cr_ea", "fail_ea", "fin_ea", "rep_ea", "prob_ea", "level_ea", "semester_ea", "prog_ea", "dropout")
    print(f"  ✓ Mapped {len(out)} students  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


def _proxy_uci_student(n):
    """Generate a proxy when the real dataset can't be downloaded."""
    rng = np.random.default_rng(42)
    gpa = np.clip(rng.normal(2.4, 0.8, n), 0.5, 4.0)
    att = np.clip(rng.normal(78, 14, n), 20, 100)
    cr  = np.clip(rng.normal(0.75, 0.18, n), 0.1, 1.1)
    fail = np.clip((rng.random(n) < 0.25).astype(int) * rng.integers(1, 4, n), 0, 4)
    label = ((1-gpa/4)*.4+(1-att/100)*.3+(1-cr)*.3 + rng.normal(0,.05,n)) > 0.45
    df = pd.DataFrame({"gpa_ea":gpa,"att_ea":att,"cr_ea":cr,"fail_ea":fail,
                        "fin_ea":rng.integers(0,2,n),"rep_ea":(fail>0).astype(int),"prob_ea":(gpa<1.5).astype(int),
                        "level_ea":np.full(n,200),"semester_ea":rng.integers(1,3,n),
                        "prog_ea":rng.choice(PROGRAMMES,n),"dropout":label.astype(int)})
    out = _build_unified(df,"gpa_ea","att_ea","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level_ea","semester_ea","prog_ea","dropout")
    print(f"  ✓ Generated {len(out)} proxy rows  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


# ══════════════════════════════════════════════════════════════════════════════
# DATASET 2 — UCI Predict Students Dropout and Academic Success (2022)
# ══════════════════════════════════════════════════════════════════════════════
def load_uci_dropout_prediction():
    """
    Most relevant dataset: 4,424 higher-education students.
    Labels: Dropout=1, Graduate=0, Enrolled=dropped (we only keep D/G).

    Column mapping:
      Curricular units 2nd sem (grade) → gpa (scaled /20 * 4)
      Curricular units 2nd sem (approved) / enrolled → credit_ratio
      Curricular units 2nd sem (without evaluations) → attendance proxy
      Debtor + Tuition fees up to date   → financial_flag
      Scholarship holder                 → financial_flag (inverse)
      Age at enrollment / Displaced      → no direct map, skip
    """
    section("Dataset 2: UCI Dropout and Academic Success (2022)")

    URL  = "https://archive.ics.uci.edu/ml/machine-learning-databases/00697/predict+students+dropout+and+academic+success.zip"
    local = dp("uci_dropout_2022.csv")

    if os.path.exists(local):
        print(f"  Loading from cache: {local}")
        df = pd.read_csv(local, sep=";")
    else:
        try:
            import requests, zipfile
            print("  Downloading UCI Dropout 2022 dataset…")
            r = requests.get(URL, timeout=30)
            if r.status_code == 200:
                z = zipfile.ZipFile(io.BytesIO(r.content))
                for name in z.namelist():
                    if name.endswith(".csv"):
                        raw = z.read(name).decode("latin-1")
                        df  = pd.read_csv(io.StringIO(raw), sep=";")
                        df.to_csv(local, index=False)
                        print(f"  ✓ Downloaded and cached {len(df)} rows")
                        break
            else:
                raise ConnectionError(f"HTTP {r.status_code}")
        except Exception as e:
            print(f"  ⚠ Could not download ({e}). Generating proxy data instead.")
            return _proxy_uci_dropout(2000)

    return _map_uci_dropout(df)


def _map_uci_dropout(df):
    df = df.copy()
    # Normalise column names
    df.columns = [c.lower().strip().replace(" ","_").replace("(","").replace(")","") for c in df.columns]

    # Keep only Dropout and Graduate
    if "target" in df.columns:
        df = df[df["target"].isin(["Dropout","Graduate"])].copy()
        df["dropout"] = (df["target"] == "Dropout").astype(int)
    else:
        return pd.DataFrame()

    # GPA: use 2nd sem grade (0-20 scale)
    grade_col = next((c for c in df.columns if "grade" in c and "2nd" in c), None)
    if grade_col:
        df["gpa_ea"] = np.clip(df[grade_col] / 20.0 * 4.0, 0, 4)
    else:
        df["gpa_ea"] = 2.5

    # Credit ratio: approved / enrolled in 2nd sem
    approved_col = next((c for c in df.columns if "approved" in c and "2nd" in c), None)
    enrolled_col = next((c for c in df.columns if "enrolled" in c and "2nd" in c), None)
    if approved_col and enrolled_col:
        enr = df[enrolled_col].replace(0, np.nan).fillna(1)
        df["cr_ea"] = np.clip(df[approved_col] / enr, 0, 1.2)
    else:
        df["cr_ea"] = 0.8

    # Attendance proxy: without_evaluations in 2nd sem = missed work
    neval_col = next((c for c in df.columns if "without_evaluations" in c and "2nd" in c), None)
    if neval_col:
        df["att_ea"] = np.clip(100 - df[neval_col] * 15, 20, 100)
    else:
        df["att_ea"] = 78.0

    # Failed modules: units not approved in 1st sem
    fail_col = next((c for c in df.columns if "evaluations" in c and "1st" in c), None)
    df["fail_ea"] = np.clip(df.get(fail_col, pd.Series(0, index=df.index)) * 0.3, 0, 4).round()

    # Financial flag: debtor OR tuition fees not up to date
    deb = df.get("debtor", pd.Series(0, index=df.index))
    tui = df.get("tuition_fees_up_to_date", pd.Series(1, index=df.index))
    df["fin_ea"] = ((deb == 1) | (tui == 0)).astype(int)

    df["rep_ea"]      = (df["fail_ea"] > 0).astype(int)
    df["prob_ea"]     = (df["gpa_ea"] < 1.5).astype(int)
    df["level_ea"]    = 200
    df["semester_ea"] = 2
    df["prog_ea"]     = np.random.choice(PROGRAMMES, size=len(df))

    out = _build_unified(df,"gpa_ea","att_ea","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level_ea","semester_ea","prog_ea","dropout")
    print(f"  ✓ Mapped {len(out)} students  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


def _proxy_uci_dropout(n):
    rng = np.random.default_rng(123)
    gpa = np.clip(rng.beta(5,3,n)*4, 0.3, 4.0)
    att = np.clip(rng.normal(74, 16, n), 15, 100)
    cr  = np.clip(rng.beta(6,2,n)*1.1, 0.05, 1.1)
    fail = np.clip((rng.random(n)<0.3)*rng.integers(1,5,n), 0, 4)
    fin  = (rng.random(n) < 0.25).astype(int)
    label = ((1-gpa/4)*.4+(1-att/100)*.3+(1-cr)*.25+fin*.05+rng.normal(0,.05,n)) > 0.42
    df = pd.DataFrame({"gpa_ea":gpa,"att_ea":att,"cr_ea":cr,"fail_ea":fail,"fin_ea":fin,
                        "rep_ea":(fail>0).astype(int),"prob_ea":(gpa<1.5).astype(int),
                        "level_ea":np.full(n,200),"semester_ea":rng.integers(1,3,n),
                        "prog_ea":rng.choice(PROGRAMMES,n),"dropout":label.astype(int)})
    out = _build_unified(df,"gpa_ea","att_ea","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level_ea","semester_ea","prog_ea","dropout")
    print(f"  ✓ Generated {len(out)} proxy rows  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


# ══════════════════════════════════════════════════════════════════════════════
# DATASET 3 — OULAD (Open University Learning Analytics)
# ══════════════════════════════════════════════════════════════════════════════
def load_oulad():
    """
    OULAD is a large dataset (32k+ students) with VLE interactions,
    assessment scores, and final results. We use only the
    studentInfo.csv which has demographics and final results.

    Column mapping:
      final_result: Withdrawn=1 dropout, Pass/Distinction=0
      num_of_prev_attempts  → failed_modules proxy
      studied_credits       → credit_ratio (vs. 240 credit target)
      disability            → financial_flag proxy (disadvantage proxy)
    """
    section("Dataset 3: OULAD (Open University Learning Analytics)")

    URL   = "https://analyse.kmi.open.ac.uk/open_dataset/download"
    local = dp("oulad_studentinfo.csv")

    if os.path.exists(local):
        print(f"  Loading from cache: {local}")
        df = pd.read_csv(local)
    else:
        try:
            import requests, zipfile
            print("  Downloading OULAD dataset (this may take a minute — it is ~100 MB)…")
            r = requests.get(URL, timeout=60, stream=True)
            if r.status_code == 200:
                content = b"".join(r.iter_content(65536))
                z = zipfile.ZipFile(io.BytesIO(content))
                for name in z.namelist():
                    if "studentInfo" in name and name.endswith(".csv"):
                        raw = z.read(name).decode("utf-8")
                        df  = pd.read_csv(io.StringIO(raw))
                        df.to_csv(local, index=False)
                        print(f"  ✓ Downloaded and cached {len(df)} rows")
                        break
            else:
                raise ConnectionError(f"HTTP {r.status_code}")
        except Exception as e:
            print(f"  ⚠ Could not download OULAD ({e}). Generating proxy data instead.")
            return _proxy_oulad(5000)

    return _map_oulad(df)


def _map_oulad(df):
    df = df.copy()
    df.columns = [c.lower().strip() for c in df.columns]

    if "final_result" not in df.columns:
        return _proxy_oulad(5000)

    # Keep only Withdrawn (dropout) and Pass/Distinction (retained)
    df = df[df["final_result"].isin(["Withdrawn","Pass","Distinction"])].copy()
    df["dropout"] = (df["final_result"] == "Withdrawn").astype(int)

    # GPA: not directly available. Use imd_band as socioeconomic proxy.
    # Higher IMD (deprivation) correlates with lower performance.
    imd_map = {"0-10%":1.2,"10-20":1.5,"20-30%":1.8,"30-40%":2.0,"40-50%":2.3,
               "50-60%":2.5,"60-70%":2.7,"70-80%":2.9,"80-90%":3.1,"90-100%":3.4}
    if "imd_band" in df.columns:
        df["gpa_ea"] = df["imd_band"].map(imd_map).fillna(2.5)
    else:
        df["gpa_ea"] = 2.5

    # Credit ratio: studied_credits / 240 (standard OU programme)
    if "studied_credits" in df.columns:
        df["cr_ea"] = np.clip(df["studied_credits"] / 240.0, 0.1, 1.2)
    else:
        df["cr_ea"] = 0.75

    # Attendance proxy: number of previous attempts (repeats = less committed)
    if "num_of_prev_attempts" in df.columns:
        df["att_ea"] = np.clip(90 - df["num_of_prev_attempts"] * 12, 30, 100)
        df["fail_ea"]= np.clip(df["num_of_prev_attempts"], 0, 4)
    else:
        df["att_ea"] = 78.0
        df["fail_ea"]= 0

    # Financial/disadvantage proxy: disability flag
    df["fin_ea"]  = (df.get("disability","N") == "Y").astype(int)
    df["rep_ea"]  = (df["fail_ea"] > 0).astype(int)
    df["prob_ea"] = (df["gpa_ea"] < 1.5).astype(int)
    df["level_ea"]    = 200
    df["semester_ea"] = 1
    df["prog_ea"]     = np.random.choice(PROGRAMMES, size=len(df))

    out = _build_unified(df,"gpa_ea","att_ea","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level_ea","semester_ea","prog_ea","dropout")
    print(f"  ✓ Mapped {len(out)} students  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


def _proxy_oulad(n):
    rng = np.random.default_rng(999)
    gpa = np.clip(rng.normal(2.6, 0.75, n), 0.5, 4.0)
    att = np.clip(rng.normal(76, 15, n), 25, 100)
    cr  = np.clip(rng.beta(7,2,n)*1.1, 0.1, 1.1)
    fail= np.clip((rng.random(n)<0.2)*rng.integers(1,4,n), 0, 3)
    fin = (rng.random(n)<0.18).astype(int)
    label = ((1-gpa/4)*.4+(1-att/100)*.3+(1-cr)*.25+fin*.05+rng.normal(0,.05,n)) > 0.40
    df = pd.DataFrame({"gpa_ea":gpa,"att_ea":att,"cr_ea":cr,"fail_ea":fail,"fin_ea":fin,
                        "rep_ea":(fail>0).astype(int),"prob_ea":(gpa<1.5).astype(int),
                        "level_ea":np.full(n,200),"semester_ea":rng.integers(1,3,n),
                        "prog_ea":rng.choice(PROGRAMMES,n),"dropout":label.astype(int)})
    out = _build_unified(df,"gpa_ea","att_ea","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level_ea","semester_ea","prog_ea","dropout")
    print(f"  ✓ Generated {len(out)} proxy rows  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


# ══════════════════════════════════════════════════════════════════════════════
# DATASET 4 — EduAlert Synthetic (UENR proxy)
# ══════════════════════════════════════════════════════════════════════════════
def generate_uenr_synthetic(n=N_SYNTHETIC):
    section("Dataset 4: EduAlert Synthetic (UENR proxy)")
    rng = np.random.default_rng(42)
    prog_diff = {"Computer Science":1.10,"Electrical Eng.":1.15,"Business Admin.":0.95,"Mech. Engineering":1.20}
    req_by_level = {100:18,200:45,300:90,400:120}
    rows = []
    for _ in range(n):
        prog     = rng.choice(PROGRAMMES, p=[.30,.25,.25,.20])
        level    = int(rng.choice([100,200,300,400], p=[.25,.28,.27,.20]))
        semester = int(rng.choice([1,2]))
        required = req_by_level[level]
        risk_drive = float(rng.beta(2,5))
        gpa        = float(np.clip(4.0 - risk_drive*3.2 + rng.normal(0,.3), 0.5, 4.0))
        attendance = float(np.clip(100 - risk_drive*60   + rng.normal(0,8),  10.0, 100.0))
        cr         = float(np.clip(1.0 - risk_drive*0.6  + rng.normal(0,.1),  0.1,  1.2))
        fail_mod   = int(np.clip(risk_drive*4 + rng.poisson(0.3), 0, 6))
        fin_flag   = int(risk_drive>.55 and rng.random()<.40)
        rep_course = int(risk_drive>.50 and rng.random()<.35)
        probation  = int(gpa<1.5 and rng.random()<.70)
        label      = 1 if risk_drive * prog_diff[prog] > 0.52 else 0
        rows.append({"gpa_ea":round(gpa,2),"att_ea":round(attendance,1),"cr_ea":round(cr,3),
                     "fail_ea":fail_mod,"fin_ea":fin_flag,"rep_ea":rep_course,"prob_ea":probation,
                     "level_ea":level,"semester_ea":semester,"prog_ea":prog,"dropout":label})
    df  = pd.DataFrame(rows)
    out = _build_unified(df,"gpa_ea","att_ea","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level_ea","semester_ea","prog_ea","dropout")
    print(f"  ✓ Generated {len(out)} UENR proxy students  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    # ── Save synthetic dataset as CSV so it can be inspected / reused ──────────
    raw_df = pd.DataFrame(rows)
    raw_df["programme"] = raw_df["prog_ea"]
    raw_df = raw_df.rename(columns={
        "gpa_ea": "gpa", "att_ea": "attendance", "cr_ea": "credit_ratio",
        "fail_ea": "failed_modules", "fin_ea": "financial_flag",
        "rep_ea": "repeated_course", "prob_ea": "probation",
        "level_ea": "level", "semester_ea": "semester",
    })
    raw_df = raw_df.drop(columns=["prog_ea"], errors="ignore")
    # Add realistic UENR student IDs and names for the synthetic set
    programmes_short = {"Computer Science":"CS","Electrical Eng.":"EE","Business Admin.":"BA","Mech. Engineering":"ME"}
    year_of_enrol = [2020 + int(lvl // 100) - 1 for lvl in raw_df["level"]]
    raw_df["student_id"] = ["UEN/" + programmes_short.get(p,"XX") + "/" + str(ye) + "/" + str(i+1).zfill(3)
                            for i, (p, ye) in enumerate(zip(raw_df["programme"], year_of_enrol))]
    # Ghanaian name pools
    first_names = ["Ama","Kofi","Abena","Kwame","Yaw","Akosua","Kwesi","Efua","Kweku","Adwoa",
                   "Nana","Fiifi","Esi","Ato","Akua","Kobby","Maame","Kojo","Adjoa","Kwabena",
                   "Ewurama","Kwadwo","Afia","Kow","Ohemaa","Asante","Barimah","Owusu","Serwaa","Poku"]
    last_names  = ["Mensah","Asante","Owusu","Boateng","Darko","Amoah","Frimpong","Acheampong","Nyarko",
                   "Adjei","Bonsu","Appiah","Ntiamoah","Kumi","Ansah","Barimah","Osei","Agyei","Tawiah",
                   "Antwi","Twumasi","Danso","Addo","Fordjour","Sarpong","Quartey","Agyemang","Asante"]
    rng2 = np.random.default_rng(123)
    raw_df["name"] = [rng2.choice(first_names) + " " + rng2.choice(last_names) for _ in range(len(raw_df))]
    cols_order = ["student_id","name","programme","level","semester","gpa","attendance","credit_ratio",
                  "failed_modules","financial_flag","repeated_course","probation","dropout"]
    raw_df = raw_df[[c for c in cols_order if c in raw_df.columns]]
    syn_path = dp("uenr_synthetic_dataset.csv")
    raw_df.to_csv(syn_path, index=False)
    print(f"  ✓ Synthetic dataset saved → {syn_path}")
    return out


# ══════════════════════════════════════════════════════════════════════════════
# UNIFIED FEATURE BUILDER
# ══════════════════════════════════════════════════════════════════════════════
_le = LabelEncoder().fit(PROGRAMMES)

def _build_unified(df, gpa, att, cr, fail, fin, rep, prob, lvl, sem, prog, tgt):
    """Map any source dataframe's columns into the 13 unified EduAlert features."""
    out = pd.DataFrame()
    out["gpa"]          = pd.to_numeric(df[gpa],  errors="coerce").clip(0, 4).fillna(2.0)
    out["attendance"]   = pd.to_numeric(df[att],  errors="coerce").clip(0,100).fillna(75)
    out["credit_ratio"] = pd.to_numeric(df[cr],   errors="coerce").clip(0, 1.2).fillna(0.75)
    out["failed_modules"]= pd.to_numeric(df[fail],errors="coerce").clip(0, 6).fillna(0).round()
    out["financial_flag"]= pd.to_numeric(df[fin], errors="coerce").clip(0,1).fillna(0).round()
    out["repeated_course"]= pd.to_numeric(df[rep],errors="coerce").clip(0,1).fillna(0).round()
    out["probation"]    = pd.to_numeric(df[prob], errors="coerce").clip(0,1).fillna(0).round()
    out["level"]        = pd.to_numeric(df[lvl],  errors="coerce").fillna(200).round()
    out["semester"]     = pd.to_numeric(df[sem],  errors="coerce").clip(1,2).fillna(1).round()
    progs = df[prog].astype(str).str.strip()
    progs = progs.where(progs.isin(PROGRAMMES), other=PROGRAMMES[0])
    out["programme_enc"] = _le.transform(progs).astype(float)
    out["gpa_norm"]      = out["gpa"] / 4.0
    out["att_norm"]      = out["attendance"] / 100.0
    out["risk_composite"]= (1-out["gpa_norm"])*.40 + (1-out["att_norm"])*.30 + (1-out["credit_ratio"])*.30
    out["dropout"]       = pd.to_numeric(df[tgt], errors="coerce").fillna(0).astype(int)
    return out.dropna().reset_index(drop=True)


FEATURE_COLS = ["gpa","attendance","credit_ratio","failed_modules","gpa_norm","att_norm",
                "risk_composite","financial_flag","repeated_course","probation","level","semester","programme_enc"]


# ══════════════════════════════════════════════════════════════════════════════
# OPTIONAL: Real UENR data
# ══════════════════════════════════════════════════════════════════════════════
def load_real_uenr(filepath):
    """
    Load and validate your real UENR student CSV.
    Required columns: gpa, attendance, credits, required, level, semester,
                      programme, failed_modules, financial_flag,
                      repeated_course, probation, dropout
    """
    section(f"Real UENR Data: {os.path.basename(filepath)}")
    abs_path = os.path.abspath(filepath)
    if not os.path.isfile(abs_path):
        print(f"  ✗ File not found: {abs_path}"); sys.exit(1)
    df = pd.read_csv(abs_path)
    df.columns = [c.strip().lower() for c in df.columns]
    required = ["gpa","attendance","credits","required","level","semester","programme","dropout"]
    miss = [c for c in required if c not in df.columns]
    if miss: print(f"  ✗ Missing columns: {miss}"); sys.exit(1)
    df = df.dropna(subset=["dropout"]).copy()
    df["cr_ea"]    = pd.to_numeric(df["credits"],errors="coerce") / pd.to_numeric(df["required"],errors="coerce").replace(0,np.nan).fillna(90)
    df["fail_ea"]  = pd.to_numeric(df.get("failed_modules",  pd.Series(0,index=df.index)), errors="coerce").fillna(0)
    df["fin_ea"]   = pd.to_numeric(df.get("financial_flag",  pd.Series(0,index=df.index)), errors="coerce").fillna(0)
    df["rep_ea"]   = pd.to_numeric(df.get("repeated_course", pd.Series(0,index=df.index)), errors="coerce").fillna(0)
    df["prob_ea"]  = pd.to_numeric(df.get("probation",       pd.Series(0,index=df.index)), errors="coerce").fillna(0)
    out = _build_unified(df,"gpa","attendance","cr_ea","fail_ea","fin_ea","rep_ea","prob_ea","level","semester","programme","dropout")
    print(f"  ✓ Loaded {len(out)} real UENR students  |  Dropout rate: {out['dropout'].mean()*100:.1f}%")
    return out


# ══════════════════════════════════════════════════════════════════════════════
# MAIN TRAINING PIPELINE
# ══════════════════════════════════════════════════════════════════════════════
def main(real_data_path=None):
    t0 = time.time()
    banner("EduAlert  |  Multi-Dataset Training Pipeline  |  Group 27 · UENR")

    # ── Collect all datasets ──────────────────────────────────────────────────
    frames = []

    df1 = load_uci_student_performance()
    if len(df1): frames.append(("UCI Student Performance", df1))

    df2 = load_uci_dropout_prediction()
    if len(df2): frames.append(("UCI Dropout 2022", df2))

    df3 = load_oulad()
    if len(df3): frames.append(("OULAD", df3))

    df4 = generate_uenr_synthetic()
    if len(df4): frames.append(("EduAlert Synthetic", df4))

    if real_data_path:
        df5 = load_real_uenr(real_data_path)
        if len(df5):
            # Duplicate real data 3× to give it more weight in training
            frames.append(("Real UENR (×3 weight)", pd.concat([df5]*3, ignore_index=True)))

    # ── Merge ─────────────────────────────────────────────────────────────────
    section("Merging All Datasets")
    combined = pd.concat([f for _, f in frames], ignore_index=True)
    combined = combined.dropna().reset_index(drop=True)

    total_dr = combined["dropout"].mean()
    print(f"\n  Sources merged:")
    for name, df in frames:
        print(f"    {name:35s}  {len(df):6d} rows  |  dropout {df['dropout'].mean()*100:.1f}%")
    print(f"\n  COMBINED TOTAL : {len(combined):,} students")
    print(f"  Overall dropout rate: {total_dr*100:.1f}%")
    print(f"  Retained: {(combined['dropout']==0).sum():,}  |  Dropout: {combined['dropout'].sum():,}")

    # ── Features ──────────────────────────────────────────────────────────────
    X = combined[FEATURE_COLS].values.astype(float)
    y = combined["dropout"].values.astype(int)

    # ── Split ─────────────────────────────────────────────────────────────────
    section("Train / Test Split")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y)
    scaler = StandardScaler()
    scaler.fit(X_train)
    print(f"  Train : {len(X_train):,}  |  Test: {len(X_test):,}")
    print(f"  Train dropout %: {y_train.mean()*100:.1f}%  |  Test: {y_test.mean()*100:.1f}%")

    # ── Models ────────────────────────────────────────────────────────────────
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=400,max_depth=12,min_samples_split=4,min_samples_leaf=2,max_features="sqrt",class_weight="balanced",random_state=RANDOM_SEED,n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=250,max_depth=4,learning_rate=0.07,subsample=0.8,min_samples_split=4,random_state=RANDOM_SEED),
        "Logistic Regression": LogisticRegression(C=1.0,max_iter=1000,class_weight="balanced",solver="lbfgs",random_state=RANDOM_SEED),
    }

    # ── Cross-validation ──────────────────────────────────────────────────────
    section(f"{N_CV_FOLDS}-Fold Cross-Validation  (AUC-ROC)")
    cv         = StratifiedKFold(n_splits=N_CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)
    cv_results = {}
    for name, clf in models.items():
        Xtr = scaler.transform(X_train) if name=="Logistic Regression" else X_train
        sc  = cross_val_score(clf, Xtr, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
        cv_results[name] = {"mean":round(float(sc.mean()),4),"std":round(float(sc.std()),4)}
        bar = "█"*int(sc.mean()*40)
        print(f"  {name:25s}  AUC {sc.mean():.4f} ± {sc.std():.4f}  {bar}")

    # ── Test evaluation ───────────────────────────────────────────────────────
    section("Final Test Set Evaluation")
    test_results = {}
    best_name, best_auc, best_model = None, -1, None
    for name, clf in models.items():
        use_sc = (name=="Logistic Regression")
        Xtr = scaler.transform(X_train) if use_sc else X_train
        Xte = scaler.transform(X_test)  if use_sc else X_test
        clf.fit(Xtr, y_train)
        yp   = clf.predict(Xte)
        yprob= clf.predict_proba(Xte)[:,1]
        tn,fp,fn,tp = confusion_matrix(y_test,yp).ravel()
        m = {"accuracy":round(float(accuracy_score(y_test,yp)),4),"precision":round(float(precision_score(y_test,yp,zero_division=0)),4),"recall":round(float(recall_score(y_test,yp,zero_division=0)),4),"f1":round(float(f1_score(y_test,yp,average="weighted")),4),"auc_roc":round(float(roc_auc_score(y_test,yprob)),4),"TP":int(tp),"TN":int(tn),"FP":int(fp),"FN":int(fn)}
        test_results[name] = m
        print(f"\n  {name}")
        print(f"    Accuracy  {m['accuracy']*100:5.1f}%  |  Precision {m['precision']*100:5.1f}%  |  Recall {m['recall']*100:5.1f}%  |  AUC {m['auc_roc']:.4f}")
        print(f"    TP={m['TP']}  TN={m['TN']}  FP={m['FP']}  FN={m['FN']}  ← FN = missed at-risk students (minimise this)")
        if m["auc_roc"] > best_auc:
            best_auc, best_name, best_model = m["auc_roc"], name, clf

    print(f"\n  {'═'*55}")
    print(f"  ✓ Best model: {best_name}  (AUC = {best_auc:.4f})")
    print(f"  {'═'*55}")

    section("Classification Report — Best Model")
    use_sc = (best_name=="Logistic Regression")
    Xte = scaler.transform(X_test) if use_sc else X_test
    print(classification_report(y_test, best_model.predict(Xte), target_names=["Retained","Dropout"]))

    # ── Feature importance ────────────────────────────────────────────────────
    section("Feature Importance (SHAP proxy)")
    use_sc_cal = (best_name=="Logistic Regression")
    Xtr_cal    = scaler.transform(X_train) if use_sc_cal else X_train
    calibrated = CalibratedClassifierCV(best_model, cv=5, method="sigmoid")
    calibrated.fit(Xtr_cal, y_train)
    try:
        base = calibrated.calibrated_classifiers_[0].estimator
        imps = base.feature_importances_
    except:
        imps = np.ones(len(FEATURE_COLS))/len(FEATURE_COLS)
    imp_dict = dict(sorted(zip(FEATURE_COLS,[round(float(v),6) for v in imps]),key=lambda x:-x[1]))
    mx = max(imp_dict.values())
    for f,v in imp_dict.items():
        print(f"  {f:22s}  {v:.4f}  {'█'*int(v/mx*45)}")

    # ── Save ─────────────────────────────────────────────────────────────────
    section("Saving Artifacts")
    print(f"  Output directory: {ARTIFACTS_DIR}\n")
    joblib.dump(calibrated,   ap("model.pkl"));      print("  ✓ model.pkl")
    joblib.dump(scaler,       ap("scaler.pkl"));     print("  ✓ scaler.pkl")
    joblib.dump(FEATURE_COLS, ap("feature_names.pkl"));print("  ✓ feature_names.pkl")
    joblib.dump(_le,          ap("label_encoder.pkl"));print("  ✓ label_encoder.pkl")

    elapsed = round(time.time()-t0,1)
    report = {
        "meta":{"project":"EduAlert UENR Group 27","script":os.path.abspath(__file__),"artifacts_dir":ARTIFACTS_DIR,"train_seconds":elapsed},
        "datasets":{name:{"rows":len(df),"dropout_rate":round(float(df["dropout"].mean()),4)} for name,df in frames},
        "combined":{"total":len(combined),"dropout_rate":round(float(total_dr),4),"train":len(X_train),"test":len(X_test)},
        "features":{"count":len(FEATURE_COLS),"names":FEATURE_COLS},
        "cross_validation":cv_results,
        "test_evaluation":{n:{**m,"cv_auc":cv_results[n]["mean"]} for n,m in test_results.items()},
        "best_model":{"name":best_name,"auc_roc":best_auc},
        "feature_importance":imp_dict,
    }
    with open(ap("training_report.json"),"w") as f:
        json.dump(report,f,indent=2)
    print("  ✓ training_report.json")

    banner(f"Done in {elapsed}s  |  {best_name}  |  AUC = {best_auc:.4f}  |  {len(combined):,} students trained")
    print(f"""
  All files saved to:
      {ARTIFACTS_DIR}

  Datasets used:
  {chr(10).join(f'    • {name} — {len(df):,} rows' for name,df in frames)}

  To add your real UENR student records (strongly recommended):
      python train_model.py --data your_uenr_data.csv

  To load the model in FastAPI:
      import joblib
      model = joblib.load("model_artifacts/model.pkl")
      scaler = joblib.load("model_artifacts/scaler.pkl")
""")
    return report


if __name__=="__main__":
    parser = argparse.ArgumentParser(description="EduAlert multi-dataset training")
    parser.add_argument("--data", type=str, default=None, help="Path to real UENR student CSV (optional)")
    args = parser.parse_args()
    main(real_data_path=args.data)