# EduAlert — Student Dropout Risk Prediction System

**University of Energy and Natural Resources (UENR) — Group 27 Final Year Project 2026**

EduAlert uses machine learning to predict student dropout risk, helping academic advisors intervene early and support at-risk students. Built with a React frontend, FastAPI backend, MongoDB database, and a scikit-learn ML model.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Backend Setup (FastAPI + MongoDB)](#backend-setup)
- [Frontend Setup (React + Vite)](#frontend-setup)
- [ML Model Training](#ml-model-training)
- [Email Configuration (SendGrid)](#email-configuration)
- [Running the Application](#running-the-application)
- [Default Account](#default-account)
- [API Documentation](#api-documentation)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend server and ML training |
| Node.js | 18+ | Frontend dev server |
| MongoDB | 6.0+ | Database (local or Atlas) |
| Git | Latest | Version control |

### Install MongoDB

**Windows (recommended):**

1. Download the MSI installer from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Run the installer, choose **Complete**, and enable **Install MongoDB as a Service**
3. Verify it is running:

```powershell
mongod --version
mongosh --eval "db.runCommand({ping: 1})"
```

**macOS (Homebrew):**

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get install -y mongosh
sudo systemctl start mongod
sudo systemctl enable mongod
```

MongoDB runs on `mongodb://localhost:27017` by default.

---

## Project Structure

```
eduAlert/
├── src/                          # React frontend (Vite)
│   └── App.jsx                   # Main single-page application
├── edualert-backend/             # FastAPI backend
│   ├── fastapi_main.py           # API server (all routes)
│   ├── db.py                     # MongoDB connection
│   ├── seed_db.py                # Create initial user accounts
│   ├── test_sendgrid.py          # Email delivery test script
│   ├── model_artifacts/          # Trained ML model files
│   │   ├── model.pkl
│   │   ├── scaler.pkl
│   │   ├── feature_names.pkl
│   │   └── label_encoder.pkl
│   └── .env                      # Environment variables (never commit)
├── datasets/                     # Training data
├── ml-training/                  # Model training notebooks/scripts
├── train_model.py                # Model training script
├── model_artifacts/              # Root-level model copy
├── requirements.txt              # Python dependencies
├── package.json                  # Node.js dependencies
├── vite.config.js                # Vite dev server config
└── README.md                     # This file
```

---

## Backend Setup

### 1. Create a virtual environment

```powershell
cd edualert-backend
python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # macOS/Linux
```

### 2. Install Python dependencies

From the project root:

```powershell
pip install -r requirements.txt
```

Key packages installed:

- **fastapi** — Web framework
- **uvicorn** — ASGI server
- **motor** — Async MongoDB driver
- **passlib[bcrypt]** — Password hashing
- **python-jose** — JWT tokens
- **joblib / numpy / scikit-learn** — ML model serving
- **sendgrid** — Email delivery

### 3. Create the `.env` file

Create `edualert-backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=edualert
JWT_SECRET=your-random-secret-string-here
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
FROM_EMAIL=your-email@example.com
```

### 4. Seed the first advisor account

```powershell
python seed_db.py
```

You will be prompted for email, name, password, and role. Example:

```
Email address  : exmaple@gmail.com
Full name      : Vincent Korang
Password       : @Vince123
Role [advisor] : advisor
```

### 5. Start the backend server

```powershell
uvicorn fastapi_main:app --reload --port 8000
```

The server starts at `http://localhost:8000`. Interactive API docs are at `http://localhost:8000/docs`.

---

## Frontend Setup

Open a **new terminal** from the project root:

```powershell
cd ..
npm install
npm run dev
```

The frontend starts at `http://localhost:5173` and connects to the backend at `http://localhost:8000`.

---

## ML Model Training

If you need to retrain the model (e.g., with new data):

```powershell
python train_model.py
```

This reads from `datasets/`, trains the model, and writes updated files to `model_artifacts/`. The backend loads `model_artifacts/model.pkl` on startup automatically.

---

## Email Configuration (SendGrid)

EduAlert uses SendGrid to send verification codes and student risk alerts.

### Setup steps

1. Create a free account at [sendgrid.com](https://sendgrid.com)
2. Go to **Settings → Sender Authentication → Single Sender Verification**
3. Verify the email address you will send from (must match `FROM_EMAIL` in `.env`)
4. Go to **Settings → API Keys → Create API Key**
5. Select **Mail Send** permission, copy the key (starts with `SG.`)
6. Add both values to `edualert-backend/.env`:

```env
SENDGRID_API_KEY=SG.your_actual_key_here
FROM_EMAIL=your-verified-email@example.com
```

7. Restart the backend server

Free tier provides 100 emails per day. If credits are exhausted, the server falls back to printing verification codes in the console (`[DEMO] Login code for ...`).

### Test email delivery

```powershell
python test_sendgrid.py
```

---

## Running the Application

### Start everything (3 terminals)

**Terminal 1 — MongoDB** (usually runs as a service automatically):

```powershell
mongod
```

**Terminal 2 — Backend API:**

```powershell
cd edualert-backend
venv\Scripts\activate
uvicorn fastapi_main:app --reload --port 8000
```

**Terminal 3 — Frontend:**

```powershell
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Default Account

| Field | Value |
|-------|-------|
| Email | `vincent.korang.stu@uenr.edu.gh` |
| Password | `@Vince123` |
| Role | advisor |

---

## API Documentation

Once the backend is running, visit:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

### Key endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Send verification code to email |
| POST | `/auth/verify-login` | Verify code and get JWT token |
| POST | `/auth/register` | Create new advisor account |
| POST | `/predict` | Predict dropout risk for a student |
| POST | `/predict/batch` | Predict for multiple students |
| GET | `/students` | List all students for the advisor |
| GET | `/analytics/cohort` | Cohort risk summary by programme |
| GET | `/health` | Server health check |

---

## Troubleshooting

**MongoDB connection refused:**
Ensure MongoDB is running. Check with `mongosh --eval "db.runCommand({ping: 1})"`.

**SendGrid 401 Unauthorized:**
- Verify the API key is correct and has **Mail Send** permission
- Verify the sender email is authenticated in SendGrid dashboard
- Check that your account has remaining email credits

**Login returns 401:**
- Ensure the account was seeded (`python seed_db.py`)
- Password is case-sensitive — type it exactly
- No leading/trailing spaces

**ML model not loaded:**
Run `python train_model.py` from the project root to generate `model_artifacts/`.

---

## Deploying to Render (Free)

This deploys the app so anyone can access it via a public URL — no local setup needed.

### Step 1 — Set up MongoDB Atlas (free cloud database)

1. Create a free account at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free **M0 cluster**
3. Under **Database Access**, create a database user (username + password)
4. Under **Network Access**, add IP address `0.0.0.0/0` (allow all)
5. Go to **Database → Connect → Connect your application** and copy the connection string
6. Replace `<password>` with your database user password — this is your `MONGO_URI`

### Step 2 — Push your code to GitHub

```powershell
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/edualert.git
git push -u origin main
```

> **Important:** Make sure `edualert-backend/.env` is NOT committed. It should be in `.gitignore`.

### Step 3 — Deploy the backend (FastAPI)

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Configure:

| Field | Value |
|-------|-------|
| Name | `edualert-api` |
| Region | closest to your users |
| Branch | `main` |
| Root Directory | `edualert-backend` |
| Runtime | `Docker` |
| Build Command | *(leave blank — Docker handles it)* |
| Start Command | *(leave blank — Dockerfile handles it)* |

5. Add **Environment Variables** (click "Advanced" → "Add Env Variable"):

| Key | Value |
|-----|-------|
| `MONGO_URI` | Your MongoDB Atlas connection string from Step 1 |
| `DB_NAME` | `edualert` |
| `SECRET_KEY` | Any long random string (e.g. `openssl rand -hex 32`) |
| `SENDGRID_API_KEY` | Your SendGrid API key |
| `FROM_EMAIL` | Your verified SendGrid sender email |
| `ALLOWED_ORIGIN` | *(leave empty for now — update after frontend is deployed)* |

6. Click **Create Web Service**
7. Wait for deployment to finish — note the URL (e.g. `https://edualert-api.onrender.com`)
8. Test: visit `https://edualert-api.onrender.com/health`

### Step 4 — Seed the production database

Once the backend is running, you need to create the first user account. In Render, go to your web service → **Shell** tab and run:

```bash
python seed_db.py
```

Or use the Swagger UI at `https://edualert-api.onrender.com/docs` to register via the `/auth/register` endpoint.

### Step 5 — Deploy the frontend (Static Site)

1. In Render, click **New → Static Site**
2. Connect the same GitHub repo
3. Configure:

| Field | Value |
|-------|-------|
| Name | `edualert` |
| Branch | `main` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

4. Add **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `https://edualert-api.onrender.com` (your backend URL from Step 3) |

5. Click **Create Static Site**
6. Wait for deployment — note the URL (e.g. `https://edualert.onrender.com`)

### Step 6 — Update backend CORS

Go back to the backend service → **Environment** tab → edit `ALLOWED_ORIGIN` to include your frontend URL:

```
https://edualert.onrender.com,http://localhost:5173
```

The backend will auto-redeploy.

### Step 7 — Create the admin account

Visit your frontend URL, click **Sign Up**, and create an advisor account. Or use the backend shell:

```bash
python seed_db.py
```

---

### How it works

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  Frontend (Static Site) │────▶│  Backend (Web Service)   │
│  edualert.onrender.com  │     │  edualert-api.onrender.com│
│  React + Vite           │     │  FastAPI + Uvicorn        │
└─────────────────────────┘     └──────────┬───────────────┘
                                           │
                                           ▼
                                ┌──────────────────────────┐
                                │  MongoDB Atlas (Free M0)  │
                                │  cloud.mongodb.com        │
                                └──────────────────────────┘
```

Both the frontend and backend stay live 24/7 on Render's free tier. You can close your laptop and the app keeps running.

> **Free tier note:** Render free services spin down after 15 minutes of inactivity. The first request after idle takes ~30 seconds to wake up. Subsequent requests are fast.
