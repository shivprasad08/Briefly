import os
from contextlib import asynccontextmanager
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from models import Session as DBSession, Document, ChatMessage
from database import init_db, get_session, close_db
from service import ingest_pdf, chat_with_documents
from pydantic import BaseModel
from datetime import datetime


# Lifespan startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    try:
        print("[*] FastAPI startup...")
        await init_db()
        print("[OK] Startup complete, server ready!")
    except Exception as e:
        print(f"[!] Startup failed: {e}")
        raise
    yield
    print("[*] FastAPI shutdown...")
    await close_db()


app = FastAPI(
    title="Context-Aware Meeting Assistant",
    description="RAG-based document management and chat system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class SessionCreate(BaseModel):
    name: str


class SessionResponse(BaseModel):
    id: int
    name: str
    current_summary: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    response: str


class DocumentResponse(BaseModel):
    id: int
    filename: str
    upload_timestamp: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True


# Routes
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/sessions", response_model=SessionResponse)
async def create_session(
    request: SessionCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new session."""
    db_session = DBSession(name=request.name)
    session.add(db_session)
    await session.commit()
    await session.refresh(db_session)
    return db_session


@app.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(session: AsyncSession = Depends(get_session)):
    """Get all sessions."""
    query = select(DBSession).order_by(DBSession.created_at.desc())
    result = await session.execute(query)
    sessions = result.scalars().all()
    return sessions


@app.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session_detail(
    session_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a specific session."""
    query = select(DBSession).where(DBSession.id == session_id)
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return db_session


@app.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    request: SessionCreate,
    session: AsyncSession = Depends(get_session),
):
    """Update a session's name."""
    query = select(DBSession).where(DBSession.id == session_id)
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db_session.name = request.name
    await session.commit()
    await session.refresh(db_session)
    return db_session


@app.post("/sessions/{session_id}/upload")
async def upload_document(
    session_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Upload a PDF to a session."""
    # Validate session exists
    query = select(DBSession).where(DBSession.id == session_id)
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate file type
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Save file
    storage_dir = Path("backend/storage")
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = storage_dir / f"session_{session_id}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create document record
    document = Document(
        session_id=session_id,
        filename=file.filename,
        file_path=str(file_path),
    )
    session.add(document)
    await session.commit()
    
    # Ingest PDF (update FAISS and summary)
    try:
        await ingest_pdf(session_id, str(file_path), session)
    except Exception as e:
        # Cleanup file on error
        if file_path.exists():
            file_path.unlink()
        import traceback
        print(f"[!] Ingestion error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    
    return {
        "filename": file.filename,
        "status": "uploaded",
        "summary_updated": True,
    }


@app.get("/sessions/{session_id}/documents", response_model=list[DocumentResponse])
async def get_documents(
    session_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get all documents for a session."""
    query = select(Document).where(Document.session_id == session_id).order_by(Document.upload_timestamp.desc())
    result = await session.execute(query)
    documents = result.scalars().all()
    return documents


@app.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat(
    session_id: int,
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),
):
    """Chat with documents in a session."""
    print(f"[*] Chat request - Session: {session_id}, Query: {request.query}")
    
    # Validate session exists
    query = select(DBSession).where(DBSession.id == session_id)
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        print("[*] Calling chat_with_documents...")
        response = await chat_with_documents(session_id, request.query, session)
        print(f"[OK] Chat response generated: {response[:100]}...")
        return {"response": response}
    except Exception as e:
        import traceback
        print(f"[!] Chat error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    session_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get chat messages for a session."""
    query = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc())
    result = await session.execute(query)
    messages = result.scalars().all()
    return messages


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
