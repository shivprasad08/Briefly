import sqlite3
import os

# Check both database locations
db_locations = [
    "meeting_assistant.db",
    "backend/meeting_assistant.db"
]

for db_path in db_locations:
    if os.path.exists(db_path):
        print(f"\n{'='*60}")
        print(f"Database: {os.path.abspath(db_path)}")
        print(f"{'='*60}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"Tables: {[t[0] for t in tables]}")
        
        # Check sessions
        try:
            cursor.execute("SELECT * FROM session")
            sessions = cursor.fetchall()
            print(f"\nSessions found: {len(sessions)}")
            for session in sessions:
                print(f"  - {session}")
        except Exception as e:
            print(f"Error reading sessions: {e}")
        
        # Check documents
        try:
            cursor.execute("SELECT id, session_id, filename FROM document")
            docs = cursor.fetchall()
            print(f"\nDocuments found: {len(docs)}")
            for doc in docs:
                print(f"  - {doc}")
        except Exception as e:
            print(f"Error reading documents: {e}")
        
        conn.close()
    else:
        print(f"\nDatabase not found: {db_path}")

# Check for orphaned storage files
print(f"\n{'='*60}")
print("Checking storage directories...")
print(f"{'='*60}")

storage_dirs = [
    "backend/storage",
    "backend/backend/storage"
]

for storage_dir in storage_dirs:
    if os.path.exists(storage_dir):
        print(f"\nStorage: {os.path.abspath(storage_dir)}")
        for item in os.listdir(storage_dir):
            print(f"  - {item}")

# Check FAISS indexes
faiss_dirs = [
    "backend/faiss_indexes",
    "backend/backend/faiss_indexes"
]

print(f"\n{'='*60}")
print("Checking FAISS index directories...")
print(f"{'='*60}")

for faiss_dir in faiss_dirs:
    if os.path.exists(faiss_dir):
        print(f"\nFAISS indexes: {os.path.abspath(faiss_dir)}")
        for item in os.listdir(faiss_dir):
            print(f"  - {item}")
