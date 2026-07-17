from motor.motor_asyncio import AsyncIOMotorClient
import os
from pymongo.errors import OperationFailure

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "edualert")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

students_col = db["students"]
users_col    = db["users"]
predictions_col = db["predictions"]
metadata_col = db["metadata"]

async def create_indexes():
    try:
        await students_col.drop_index("student_id_1")
    except OperationFailure:
        pass
    await students_col.create_index([("advisor_email", 1), ("student_id", 1)], unique=True)
    await students_col.create_index("advisor_email")
    await users_col.create_index("email", unique=True)
    await predictions_col.create_index("advisor_email")
    await predictions_col.create_index("timestamp")
