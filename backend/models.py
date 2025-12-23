from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class Session(SQLModel, table=True):
    """Represents a meeting session where users upload documents and chat."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    current_summary: Optional[str] = Field(default=None)  # Evolving summary
    faiss_index_path: Optional[str] = Field(default=None)  # Path to .index file
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
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
    
    # Relationship
    session: Optional[Session] = Relationship(back_populates="documents")


class ChatMessage(SQLModel, table=True):
    """Represents a chat message (user question or assistant response)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    role: str = Field(index=True)  # "user" or "assistant"
    content: str  # Text content of the message
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    session: Optional[Session] = Relationship(back_populates="messages")
