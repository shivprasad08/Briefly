#!/usr/bin/env python
"""
Database initialization and utility script.
Usage:
    python init_db.py  # Create tables
"""

import asyncio
import os
from database import init_db


async def main():
    print("🔄 Initializing database...")
    try:
        await init_db()
        print("✅ Database initialized successfully!")
        print("   Tables created:")
        print("   - Session")
        print("   - Document")
        print("   - ChatMessage")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
