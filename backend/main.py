import os
from contextlib import asynccontextmanager
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from models import User, Session as DBSession, Document, ChatMessage
from database import init_db, get_session, close_db
from service import ingest_pdf, chat_with_documents
from auth import verify_password, get_password_hash, create_access_token, verify_token
from pydantic import BaseModel, EmailStr
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

# Security
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), session: AsyncSession = Depends(get_session)) -> User:
    """Dependency to get current authenticated user from JWT token."""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email: str = payload.get("email")
    
    # Fetch user from database
    query = select(User).where(User.email == email)
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    
    return user


# Request/Response models
class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


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


@app.post("/auth/signup", response_model=TokenResponse)
async def signup(
    request: SignupRequest,
    session: AsyncSession = Depends(get_session),
):
    """Register a new user."""
    # Check if user already exists
    query = select(User).where(User.email == request.email)
    result = await session.execute(query)
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(request.password)
    user = User(email=request.email, hashed_password=hashed_password)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    # Generate token
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
    }


@app.post("/auth/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Login user and get access token."""
    # Find user
    query = select(User).where(User.email == request.email)
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Generate token
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
    }


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@app.post("/sessions", response_model=SessionResponse)
async def create_session(
    request: SessionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new session."""
    db_session = DBSession(name=request.name, user_id=current_user.id)
    session.add(db_session)
    await session.commit()
    await session.refresh(db_session)
    return db_session


@app.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get all sessions for current user."""
    query = select(DBSession).where(DBSession.user_id == current_user.id).order_by(DBSession.created_at.desc())
    result = await session.execute(query)
    sessions = result.scalars().all()
    return sessions


@app.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session_detail(
    session_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get a specific session."""
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return db_session


@app.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    request: SessionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update a session's name."""
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db_session.name = request.name
    await session.commit()
    await session.refresh(db_session)
    return db_session


@app.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a session."""
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await session.delete(db_session)
    await session.commit()
    return {"status": "deleted"}



@app.post("/sessions/{session_id}/upload")
async def upload_document(
    session_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Upload a PDF to a session."""
    # Validate session exists and belongs to user
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get all documents for a session."""
    # Verify session belongs to user
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    doc_query = select(Document).where(Document.session_id == session_id).order_by(Document.upload_timestamp.desc())
    doc_result = await session.execute(doc_query)
    documents = doc_result.scalars().all()
    return documents


@app.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat(
    session_id: int,
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Chat with documents in a session."""
    print(f"[*] Chat request - Session: {session_id}, Query: {request.query}")
    
    # Validate session exists and belongs to user
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get chat messages for a session."""
    # Verify session belongs to user
    query = select(DBSession).where(
        (DBSession.id == session_id) & (DBSession.user_id == current_user.id)
    )
    result = await session.execute(query)
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    msg_query = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc())
    msg_result = await session.execute(msg_query)
    messages = msg_result.scalars().all()
    return messages


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
