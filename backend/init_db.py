#!/usr/bin/env python
"""
Database initialization and utility script.
Usage:
    python init_db.py  # Create tables
"""

import asyncio
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from database import init_db
from models import (  # Import all models so SQLModel metadata includes every table
    User,
    Session,
    Document,
    ChatMessage,
    Conversation,
    ConversationMessage,
)


async def main():
    print("🔄 Initializing database...")
    try:
        await init_db()
        print("✅ Database initialized successfully!")
        print("   Tables created:")
        print("   - User")
        print("   - Session")
        print("   - Document")
        print("   - ChatMessage")
        print("   - Conversation")
        print("   - ConversationMessage")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
