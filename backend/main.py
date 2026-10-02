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
from models import (
    User,
    Session as DBSession,
    Document,
    ChatMessage,
    RefreshToken,
    Conversation,
    ConversationMessage,
    ConversationMessageRole,
)
from database import init_db, get_session, close_db
from service import ingest_pdf, chat_with_documents
from auth import (
    verify_password, get_password_hash, create_access_token, verify_token,
    create_refresh_token, hash_refresh_token, verify_refresh_token
)
from jose import ExpiredSignatureError, JWTError
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
from uuid import UUID
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


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
    try:
        payload = verify_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
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

class RefreshRequest(BaseModel):
    refresh_token: str

class GoogleAuthRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str
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
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


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


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


class ConversationMessageCreate(BaseModel):
    role: ConversationMessageRole
    content: str
    sources: list[dict] | None = None


class ConversationMessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: ConversationMessageRole
    content: str
    sources: list[dict] | None
    created_at: datetime


class ConversationDetailResponse(ConversationResponse):
    messages: list[ConversationMessageResponse]


def conversation_response(conversation: Conversation) -> ConversationResponse:
    return ConversationResponse(
        id=str(conversation.id),
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


async def get_owned_conversation(
    conversation_id: str,
    current_user: User,
    session: AsyncSession,
) -> Conversation:
    """Load a conversation and distinguish missing resources from ownership failures."""
    try:
        conversation_uuid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await session.execute(
        select(Conversation).where(Conversation.id == conversation_uuid)
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Conversation access denied")
    return conversation


def conversation_title(content: str) -> str:
    words = content.split()
    title = " ".join(words[:6]).strip()
    return title[:80] or "New conversation"


from fastapi import Request

# Basic Rate Limiting for Auth
auth_rate_limits = {}

def rate_limit(request: Request):
    """Simple in-memory rate limiter for auth endpoints (max 5 requests per minute per IP)."""
    ip = request.client.host
    now = datetime.now()
    if ip not in auth_rate_limits:
        auth_rate_limits[ip] = []
        
    # Clean up old requests (older than 1 minute)
    auth_rate_limits[ip] = [t for t in auth_rate_limits[ip] if now - t < timedelta(minutes=1)]
    
    if len(auth_rate_limits[ip]) >= 5:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        
    auth_rate_limits[ip].append(now)

# Routes
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/auth/signup", response_model=TokenResponse, dependencies=[Depends(rate_limit)])
async def signup(
    request: SignupRequest,
    session: AsyncSession = Depends(get_session),
):
    """Register a new user."""
    # Validate password length
    if len(request.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
        
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
    user = User(email=request.email, hashed_password=hashed_password, oauth_provider="local")
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    # Generate tokens
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token()
    
    # Store refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=expires_at
    )
    session.add(db_refresh_token)
    await session.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "user_id": user.id,
        "email": user.email,
    }


@app.post("/auth/login", response_model=TokenResponse, dependencies=[Depends(rate_limit)])
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Login user and get access and refresh tokens."""
    # Find user
    query = select(User).where(User.email == request.email)
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Generate tokens
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token()
    
    # Store refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=expires_at
    )
    session.add(db_refresh_token)
    await session.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "user_id": user.id,
        "email": user.email,
    }


@app.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token_route(
    request: RefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    """Refresh access token and rotate refresh token."""
    # Hash the provided token to look it up
    hashed = hash_refresh_token(request.refresh_token)
    
    query = select(RefreshToken).where(RefreshToken.token_hash == hashed)
    result = await session.execute(query)
    db_token = result.scalar_one_or_none()
    
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if db_token.revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
        
    # Get user
    query_user = select(User).where(User.id == db_token.user_id)
    result_user = await session.execute(query_user)
    user = result_user.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
        
    # Revoke old token
    db_token.revoked = True
    session.add(db_token)
    
    # Issue new tokens
    new_access = create_access_token(data={"sub": user.email})
    new_refresh = create_refresh_token()
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_refresh),
        expires_at=expires_at
    )
    session.add(new_db_token)
    await session.commit()
    
    return {
        "access_token": new_access,
        "token_type": "bearer",
        "refresh_token": new_refresh,
        "user_id": user.id,
        "email": user.email,
    }


@app.post("/auth/logout")
async def logout(
    request: RefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    """Logout user by revoking refresh token."""
    hashed = hash_refresh_token(request.refresh_token)
    query = select(RefreshToken).where(RefreshToken.token_hash == hashed)
    result = await session.execute(query)
    db_token = result.scalar_one_or_none()
    
    if db_token and not db_token.revoked:
        db_token.revoked = True
        session.add(db_token)
        await session.commit()
        
    return {"status": "logged out"}


@app.post("/auth/google", response_model=TokenResponse)
async def google_auth(
    request: GoogleAuthRequest,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate with Google ID token."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="Google Auth not configured")
        
    try:
        idinfo = id_token.verify_oauth2_token(
            request.id_token, google_requests.Request(), client_id
        )
        email = idinfo.get("email")
        if not email:
            raise ValueError("No email in token")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Google token: {e}")
        
    # Find user or create
    query = select(User).where(User.email == email)
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new google user
        user = User(email=email, oauth_provider="google")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
    # Issue tokens
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token()
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=expires_at
    )
    session.add(db_refresh_token)
    await session.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "user_id": user.id,
        "email": user.email,
    }

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@app.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    conversation = Conversation(user_id=current_user.id, title=request.title)
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return conversation_response(conversation)


@app.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    return [conversation_response(item) for item in result.scalars().all()]


@app.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    conversation = await get_owned_conversation(conversation_id, current_user, session)
    messages_result = await session.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation.id)
        .order_by(ConversationMessage.created_at.asc(), ConversationMessage.id.asc())
    )
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": [
            {
                "id": str(message.id),
                "conversation_id": str(message.conversation_id),
                "role": message.role,
                "content": message.content,
                "sources": message.sources,
                "created_at": message.created_at,
            }
            for message in messages_result.scalars().all()
        ],
    }


@app.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation(
    conversation_id: str,
    request: ConversationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    conversation = await get_owned_conversation(conversation_id, current_user, session)
    conversation.title = request.title.strip() if request.title else None
    conversation.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(conversation)
    return conversation_response(conversation)


@app.post("/conversations/{conversation_id}/messages", response_model=ConversationMessageResponse)
async def append_conversation_message(
    conversation_id: str,
    request: ConversationMessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    conversation = await get_owned_conversation(conversation_id, current_user, session)
    message = ConversationMessage(
        conversation_id=conversation.id,
        role=request.role,
        content=request.content,
        sources=request.sources,
    )
    session.add(message)
    if conversation.title is None and request.role == ConversationMessageRole.USER:
        conversation.title = conversation_title(request.content)
    conversation.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(message)
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "role": message.role,
        "content": message.content,
        "sources": message.sources,
        "created_at": message.created_at,
    }


@app.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    conversation = await get_owned_conversation(conversation_id, current_user, session)
    await session.delete(conversation)
    await session.commit()
    return {"status": "deleted"}


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
    
    # Ingest PDF (update FAISS/DB and summary)
    try:
        await ingest_pdf(session_id, str(file_path), session, document.id)
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
        conversation_uuid = None
        if request.conversation_id:
            conversation = await get_owned_conversation(
                request.conversation_id, current_user, session
            )
            conversation_uuid = conversation.id
        print("[*] Calling chat_with_documents...")
        response, conversation_id = await chat_with_documents(
            session_id,
            request.query,
            session,
            current_user.id,
            conversation_uuid,
        )
        print(f"[OK] Chat response generated: {response[:100]}...")
        return {"response": response, "conversation_id": str(conversation_id)}
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
