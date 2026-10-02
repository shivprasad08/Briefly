import asyncio
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from database import engine
import models  # noqa: F401 - register all SQLModel tables before create_all

async def run_migration():
    print("🔄 Running database migration for hybrid search...")
    async with engine.begin() as conn:
        print("  - Enabling pgvector extension...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
        # SQLModel should have created the tables if we used create_all, but we might need to add missing columns to an existing db
        print("  - Checking/adding tsv column and index to chunk table...")
        try:
            # We assume chunk table might not exist if it's new, but if it does, add tsv
            # In a real app we'd use alembic. Here we just run raw sql.
            await conn.execute(text("ALTER TABLE chunk ADD COLUMN IF NOT EXISTS tsv tsvector;"))
            
            # Create GIN index for full-text search
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chunk_tsv ON chunk USING gin(tsv);"))
            
            # Trigger or update to populate tsv from content (optional, or just do it in python during insert)
            await conn.execute(text("UPDATE chunk SET tsv = to_tsvector('english', content) WHERE tsv IS NULL;"))
            
            # Auth migrations
            print("  - Updating user table for auth changes...")
            await conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN hashed_password DROP NOT NULL;"))
            await conn.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR DEFAULT 'local' NOT NULL;"))
            
            # Since RefreshToken is a new table, it will be created by init_db.py if we run it, but we can also just run create_all here.
            # But just in case, we can import SQLModel and create_all
            from sqlmodel import SQLModel
            await conn.run_sync(SQLModel.metadata.create_all)

            # Conversation history is user-scoped and ordered by these indexes.
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_messages_conversation_id "
                "ON messages (conversation_id);"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_conversations_user_id "
                "ON conversations (user_id);"
            ))
            
            print("✅ Migration completed successfully!")
        except Exception as e:
            print(f"⚠️ Warning during migration (maybe table doesn't exist yet): {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
