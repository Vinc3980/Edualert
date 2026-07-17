"""
EduAlert — Database Seeder (seed_db.py)
=======================================
Run this script ONCE to create the first advisor account.

Usage:
    python seed_db.py

You will be prompted for email, name, and password.
"""

import asyncio
from dotenv import load_dotenv
from passlib.context import CryptContext
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "edualert")
pwd_ctx   = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db     = client[DB_NAME]
    users  = db["users"]

    print("─" * 50)
    print("EduAlert — Create First Advisor Account")
    print("─" * 50)

    email    = input("Email address  : ").strip()
    name     = input("Full name      : ").strip()
    password = input("Password       : ").strip()
    role     = input("Role [advisor] : ").strip() or "advisor"

    if not email or not password or not name:
        print("✗ All fields required.")
        return

    existing = await users.find_one({"email": email})
    if existing:
        print(f"✗ An account for {email} already exists.")
        client.close()
        return

    await users.insert_one({
        "email":     email,
        "hashed_pw": pwd_ctx.hash(password),
        "name":      name,
        "role":      role,
        "created":   datetime.utcnow(),
    })

    print(f"\n✓ Account created for {email} (role: {role})")
    print("  You can now log in at http://localhost:8000/docs or via the React app.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())