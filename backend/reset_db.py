#!/usr/bin/env python
"""
Database reset script - drops and recreates all tables.
WARNING: This will delete all existing data!
Usage:
    python reset_db.py
"""

import asyncio
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from database import engine
from sqlmodel import SQLModel
from models import User, Session, Document, ChatMessage  # Import all models


async def reset_database():
    print("⚠️  WARNING: This will delete ALL data in the database!")
    print("🔄 Dropping all tables...")
    try:
        async with engine.begin() as conn:
            # Drop all tables
            await conn.run_sync(SQLModel.metadata.drop_all)
        print("✅ All tables dropped successfully!")
        
        print("🔄 Creating all tables...")
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(SQLModel.metadata.create_all)
        print("✅ Database reset complete!")
        print("   Tables created:")
        print("   - user")
        print("   - session (with user_id column)")
        print("   - document")
        print("   - chatmessage")
    except Exception as e:
        print(f"❌ Database reset failed: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_database())
