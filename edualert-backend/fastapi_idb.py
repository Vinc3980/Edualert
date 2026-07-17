"""
EduAlert — MongoDB Connection Module (db.py)
============================================
Place this file in:  edualert-backend/db.py

This module creates the async MongoDB connection using Motor
and exports collection objects used throughout the API routes.

Motor is the official async MongoDB driver for Python.
It integrates perfectly with FastAPI's async request handling.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load .env file (MONGO_URI, SECRET_KEY, ALLOWED_ORIGIN)
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "edualert")

# ── Connection ─────────────────────────────────────────────────────────────────
# Motor creates a connection pool automatically.
# This client is shared across all requests — do NOT create a new client
# per request, as that is extremely slow.
client = AsyncIOMotorClient(MONGO_URI)
db     = client[DB_NAME]

# ── Collections ────────────────────────────────────────────────────────────────
students_col    = db["students"]        # Student profiles + risk + interventions
users_col       = db["users"]           # Advisor accounts (hashed passwords)
predictions_col = db["predictions_log"] # Audit trail of every prediction made
metadata_col    = db["model_metadata"]  # Model version + performance stats

# ── Index creation (call once at startup) ─────────────────────────────────────
async def create_indexes():
    """
    Creates database indexes for fast queries.
    Called automatically when the FastAPI app starts (see lifespan in main.py).
    Safe to call multiple times — MongoDB ignores duplicate index creation.
    """
    # students: fast lookup by ID, fast sort by risk score
    await students_col.create_index("student_id", unique=True)
    await students_col.create_index([("risk_score", -1)])
    await students_col.create_index("programme")
    await students_col.create_index("level")

    # users: fast login lookup by email
    await users_col.create_index("email", unique=True)

    # predictions: audit queries by student and time
    await predictions_col.create_index("student_id")
    await predictions_col.create_index([("timestamp", -1)])

    print("✓ Database indexes created")