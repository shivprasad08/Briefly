import asyncio
import os
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlmodel import SQLModel

TEST_DATABASE_PATH = Path(__file__).with_name(".pytest.sqlite3")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DATABASE_PATH}"

from database import async_session, engine
import database
import main
from models import RefreshToken, User
from auth import get_password_hash
from main import app, rate_limit


AUTH_TABLES = [User.__table__, RefreshToken.__table__]


async def init_test_db() -> None:
    """Create only SQLite-safe auth tables (JSONB/pgvector tables are Postgres-only)."""
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: SQLModel.metadata.create_all(sync_conn, tables=AUTH_TABLES)
        )


async def close_test_db() -> None:
    # Keep the engine alive across TestClient lifespan shutdowns.
    return None


database.init_db = init_test_db
main.init_db = init_test_db
main.close_db = close_test_db


async def _clear_database() -> None:
    async with async_session() as session:
        await session.execute(delete(RefreshToken))
        await session.execute(delete(User))
        await session.commit()


@pytest.fixture
def client():
    app.dependency_overrides[rate_limit] = lambda: None
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(rate_limit, None)


@pytest.fixture
def test_user():
    email = "auth-fixture@example.com"
    password = "testpass123"

    async def create_user():
        async with async_session() as session:
            user = User(email=email, hashed_password=get_password_hash(password))
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user

    user = asyncio.run(create_user())
    yield SimpleNamespace(id=user.id, email=email, password=password)

    async def delete_user():
        async with async_session() as session:
            await session.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
            await session.execute(delete(User).where(User.id == user.id))
            await session.commit()

    asyncio.run(delete_user())


@pytest.fixture(autouse=True)
def clean_test_database():
    asyncio.run(_clear_database())
    yield
    asyncio.run(_clear_database())


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    asyncio.run(init_test_db())
    yield
    asyncio.run(engine.dispose())
    if TEST_DATABASE_PATH.exists():
        TEST_DATABASE_PATH.unlink()
