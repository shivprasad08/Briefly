"""
Session recovery script - recreates session records from orphaned FAISS indexes
"""
import asyncio
import os
from pathlib import Path
from datetime import datetime
from sqlmodel import select
from database import async_session, init_db
from models import Session, Document


async def recover_sessions():
    """Recover session records from FAISS indexes and storage files."""
    print("\n🔄 Session Recovery Tool\n")
    print("="*60)
    
    await init_db()
    
    faiss_dir = Path("backend/faiss_indexes")
    storage_dir = Path("backend/storage")
    
    # Find all session directories
    session_dirs = [d for d in faiss_dir.iterdir() if d.is_dir() and d.name.startswith("session_")]
    
    print(f"Found {len(session_dirs)} FAISS index directories")
    
    async with async_session() as db:
        for session_dir in sorted(session_dirs):
            session_id = int(session_dir.name.split("_")[1])
            
            # Check if session already exists
            result = await db.execute(
                select(Session).where(Session.id == session_id)
            )
            existing_session = result.scalar_one_or_none()
            
            if existing_session:
                print(f"  ✓ Session {session_id} already exists")
                continue
            
            # Find associated documents in storage
            doc_files = list(storage_dir.glob(f"session_{session_id}_*"))
            
            print(f"\n  📁 Recovering Session {session_id}")
            print(f"     FAISS index: {session_dir}")
            print(f"     Documents: {len(doc_files)} files found")
            
            # Create session record
            new_session = Session(
                id=session_id,
                name=f"Recovered Session {session_id}",
                created_at=datetime.utcnow(),
                faiss_index_path=str(session_dir / "index.faiss") if (session_dir / "index.faiss").exists() else None
            )
            db.add(new_session)
            
            # Create document records
            for doc_file in doc_files:
                # Extract original filename from the storage filename
                # Format: session_{id}_{original_filename}
                original_name = "_".join(doc_file.name.split("_")[2:])
                
                doc = Document(
                    session_id=session_id,
                    filename=original_name,
                    file_path=str(doc_file),
                    content_preview="[Recovered document - content not available]"
                )
                db.add(doc)
                print(f"     - {original_name}")
            
            await db.commit()
            print(f"  ✅ Session {session_id} recovered!")
        
        # Show final status
        result = await db.execute(select(Session))
        all_sessions = result.scalars().all()
        
        print("\n" + "="*60)
        print(f"✅ Recovery complete! Total sessions: {len(all_sessions)}")
        for session in all_sessions:
            print(f"  - Session {session.id}: {session.created_at}")


if __name__ == "__main__":
    asyncio.run(recover_sessions())
