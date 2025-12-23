from typing import AsyncGenerator
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path

# Use absolute path for database to avoid working directory issues
BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "meeting_assistant.db"

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DB_PATH}"
)

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

# Create async session factory
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    future=True,
)


async def init_db():
    """Initialize database tables."""
    try:
        print("[*] Initializing database...")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        print("[OK] Database initialized successfully!")
    except Exception as e:
        print(f"[!] Database initialization failed: {e}")
        raise


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection for database sessions."""
    async with async_session() as session:
        yield session


async def close_db():
    """Close database engine."""
    await engine.dispose()
