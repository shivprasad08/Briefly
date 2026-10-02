from datetime import datetime
from enum import Enum
from typing import Optional, List
from uuid import UUID, uuid4
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, JSON, Text
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    """Represents a user in the system."""
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: Optional[str] = Field(default=None)
    oauth_provider: str = Field(default="local")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    sessions: List["Session"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    refresh_tokens: List["RefreshToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    password_reset_tokens: List["PasswordResetToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    conversations: List["Conversation"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class RefreshToken(SQLModel, table=True):
    """Represents a refresh token for maintaining user sessions."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime
    revoked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    user: Optional[User] = Relationship(back_populates="refresh_tokens")


class PasswordResetToken(SQLModel, table=True):
    """One-time token used to reset a local user's password."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional[User] = Relationship(back_populates="password_reset_tokens")


class Session(SQLModel, table=True):
    """Represents a meeting session where users upload documents and chat."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str = Field(index=True)
    current_summary: Optional[str] = Field(default=None)  # Evolving summary
    faiss_index_path: Optional[str] = Field(default=None)  # Path to .index file
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional[User] = Relationship(back_populates="sessions")
    documents: List["Document"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    messages: List["ChatMessage"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Document(SQLModel, table=True):
    """Represents a PDF document uploaded to a session."""
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    filename: str
    file_path: str  # Local path where PDF is stored
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    # Relationship back to session already defined above
    session: Optional[Session] = Relationship(
        back_populates="documents",
    )
    # Relationship to chunks
    chunks: List["Chunk"] = Relationship(
        back_populates="document",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Chunk(SQLModel, table=True):
    """Represents a chunk of text from a document."""
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    content: str
    # Vector embedding stored as JSON list (SQLite-compatible)
    embedding: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    # Full-text search vector for sparse retrieval
    tsv: str = Field(default=None)
    
    # Relationship
    document: Optional[Document] = Relationship(back_populates="chunks")


class ChatMessage(SQLModel, table=True):
    """Represents a chat message (user question or assistant response)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    role: str = Field(index=True)  # "user" or "assistant"
    content: str  # Text content of the message
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    session: Optional[Session] = Relationship(back_populates="messages")


class ConversationMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class Conversation(SQLModel, table=True):
    """A user-owned conversation containing an ordered message history."""

    __tablename__ = "conversations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )

    user: Optional[User] = Relationship(back_populates="conversations")
    messages: List["ConversationMessage"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class ConversationMessage(SQLModel, table=True):
    """A persisted user or assistant message in a conversation."""

    __tablename__ = "messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    conversation_id: UUID = Field(
        sa_column=Column(
            ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    role: ConversationMessageRole = Field(
        sa_column=Column(
            SAEnum(ConversationMessageRole, name="conversation_message_role"),
            nullable=False,
        )
    )
    content: str = Field(nullable=False)
    sources: Optional[list] = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    conversation: Optional[Conversation] = Relationship(back_populates="messages")
