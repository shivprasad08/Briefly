import os
import shutil
from typing import Optional, List
from pathlib import Path
from uuid import UUID
from datetime import datetime
import faiss
import numpy as np
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from config import GROQ_API_KEY, GROQ_MODEL
from langchain_core.prompts import PromptTemplate
from langchain_community.vectorstores import FAISS
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, Session as SQLSession
from models import (
    Session,
    Document,
    ChatMessage,
    Conversation,
    ConversationMessage,
    ConversationMessageRole,
)


# Lazy-load embeddings to avoid slow initialization at import time
_embeddings = None

def get_embeddings() -> HuggingFaceEmbeddings:
    """Get or create embeddings instance (lazy-loaded)."""
    global _embeddings
    if _embeddings is None:
        print("[*] Loading HuggingFace embeddings (this may take a moment)...")
        _embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        print("[OK] Embeddings loaded")
    return _embeddings

def get_llm() -> ChatGroq:
    """Create a Groq client on-demand. Raises if API key missing."""
    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY not configured. Set it in backend/.env or environment."
        )
    return ChatGroq(
        model=GROQ_MODEL,
        temperature=0,
        max_retries=2,
        groq_api_key=GROQ_API_KEY,
    )

# Text splitter configuration
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)

# Use absolute paths based on this file's location to avoid working directory issues
BASE_DIR = Path(__file__).parent
STORAGE_DIR = BASE_DIR / "storage"
FAISS_INDEX_DIR = BASE_DIR / "faiss_indexes"

# Ensure directories exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)


async def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file."""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text


async def generate_new_summary(text: str) -> str:
    """Generate a summary of newly uploaded PDF using Groq."""
    # Groq on-demand tier has a low TPM limit; trim very large docs before summarizing
    MAX_CHARS = 12000  # ~5-6k tokens, stays under 6k TPM
    trimmed_text = text[:MAX_CHARS]

    prompt = PromptTemplate(
        input_variables=["text"],
        template="""Summarize the following document concisely, highlighting key points, dates, decisions, and action items:

{text}

Provide a clear, structured summary."""
    )
    
    llm = get_llm()
    chain = prompt | llm
    result = chain.invoke({"text": trimmed_text})
    return result.content


async def refine_summary(
    new_summary: str,
    old_summary: Optional[str],
    recent_context: str,
) -> str:
    """Integrate new summary with old summary using LLM."""
    if not old_summary:
        return new_summary
    
    prompt = PromptTemplate(
        input_variables=["old_summary", "new_summary", "context"],
        template="""You are summarizing meeting documents incrementally. Integrate the new information into the existing summary:

EXISTING SUMMARY:
{old_summary}

NEW INFORMATION:
{new_summary}

RECENT USER QUESTIONS (Context):
{context}

Task:
1. Integrate new information seamlessly
2. Resolve any conflicts or contradictions
3. Keep a consistent tone and structure
4. Highlight details relevant to the user's recent questions
5. Remove redundancies
6. Maintain chronological order where applicable

Return the refined, integrated summary."""
    )
    
    llm = get_llm()
    chain = prompt | llm
    result = chain.invoke({
        "old_summary": old_summary,
        "new_summary": new_summary,
        "context": recent_context,
    })
    return result.content


async def get_recent_context(session_id: int, session_db: AsyncSession) -> str:
    """Retrieve recent chat messages for context."""
    query = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.desc()).limit(5)
    result = await session_db.execute(query)
    messages = result.scalars().all()
    
    context = ""
    for msg in reversed(messages):
        context += f"{msg.role.upper()}: {msg.content}\n"
    
    return context if context else "No recent context."


async def ingest_pdf(session_id: int, file_path: str, session_db: AsyncSession, document_id: int) -> None:
    """
    Ingest a PDF file:
    1. Extract text
    2. Update Database with Chunk embeddings
    3. Update session summary
    """
    # Get session
    query = select(Session).where(Session.id == session_id)
    result = await session_db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    # Extract text from PDF
    text = await extract_text_from_pdf(file_path)
    
    # Chunk the text
    chunks = text_splitter.split_text(text)

    # Guard: if no text was extracted, fail fast to avoid empty index
    if not text.strip() or not chunks:
        raise ValueError("PDF has no extractable text; please upload a PDF with text content")
    
    # Import here to avoid circular imports
    from hybrid_search import embed_chunks
    from models import Chunk
    
    # Batch embed the chunks
    embeddings = embed_chunks(chunks)
    
    # Create Chunk records
    db_chunks = []
    for idx, content in enumerate(chunks):
        embedding = embeddings[idx] if idx < len(embeddings) else []
        if embedding:
            chunk = Chunk(
                document_id=document_id,
                content=content,
                embedding=embedding,
                # tsv will be populated by DB if trigger exists, or we can just leave it NULL and let migration update it
            )
            session_db.add(chunk)
            db_chunks.append(chunk)
            
    if db_chunks:
        await session_db.commit()
    
    # Note: We keep faiss_index_path populated as a flag if needed, or we could remove it.
    session.faiss_index_path = f"db_indexed_doc_{document_id}"
    
    # Generate summary of new PDF
    new_summary = await generate_new_summary(text)
    
    # Get recent context
    recent_context = await get_recent_context(session_id, session_db)
    
    # Refine the overall summary
    refined_summary = await refine_summary(
        new_summary=new_summary,
        old_summary=session.current_summary,
        recent_context=recent_context,
    )
    
    session.current_summary = refined_summary
    
    # Save changes
    session_db.add(session)
    await session_db.commit()
    await session_db.refresh(session)


async def chat_with_documents(
    session_id: int,
    query: str,
    session_db: AsyncSession,
    user_id: Optional[int] = None,
    conversation_id: Optional[UUID] = None,
) -> tuple[str, UUID]:
    """
    Chat with documents using RAG:
    1. Load FAISS index
    2. Perform similarity search
    3. Generate response with LLM
    4. Save messages to DB
    5. Return response
    """
    print(f"[*] chat_with_documents called for session {session_id}, query: '{query}'")
    
    if user_id is None:
        raise ValueError("user_id is required to persist a conversation")

    conversation = None
    if conversation_id is not None:
        conversation_result = await session_db.execute(
            select(Conversation).where(
                (Conversation.id == conversation_id)
                & (Conversation.user_id == user_id)
            )
        )
        conversation = conversation_result.scalar_one_or_none()
        if conversation is None:
            raise ValueError("Conversation not found")
    else:
        conversation = Conversation(user_id=user_id)
        session_db.add(conversation)
        await session_db.flush()

    # Get session
    query_obj = select(Session).where(Session.id == session_id)
    result = await session_db.execute(query_obj)
    session = result.scalar_one_or_none()
    
    if not session or not session.faiss_index_path:
        print("[!] No FAISS index found")
        answer = "No documents uploaded yet. Please upload PDFs first."
        session_db.add(ConversationMessage(conversation_id=conversation.id, role=ConversationMessageRole.USER, content=query))
        session_db.add(ConversationMessage(conversation_id=conversation.id, role=ConversationMessageRole.ASSISTANT, content=answer))
        if conversation.title is None:
            conversation.title = " ".join(query.split()[:6])[:80] or "New conversation"
        conversation.updated_at = datetime.utcnow()
        await session_db.commit()
        return answer, conversation.id
    
    # Load FAISS index
    faiss_path = session.faiss_index_path
    if not os.path.exists(faiss_path):
        print(f"[!] FAISS path not found: {faiss_path}")
        answer = "Vector store not found. Please re-upload documents."
        session_db.add(ConversationMessage(conversation_id=conversation.id, role=ConversationMessageRole.USER, content=query))
        session_db.add(ConversationMessage(conversation_id=conversation.id, role=ConversationMessageRole.ASSISTANT, content=answer))
        if conversation.title is None:
            conversation.title = " ".join(query.split()[:6])[:80] or "New conversation"
        conversation.updated_at = datetime.utcnow()
        await session_db.commit()
        return answer, conversation.id
    
    try:
        # Retrieve relevant documents using hybrid search
        print("[*] Retrieving relevant documents via hybrid search...")
        from hybrid_search import hybrid_retrieve
        chunks = await hybrid_retrieve(session_db, session_id, query)
        
        # Format for LLM prompt
        docs = [{"page_content": c.content} for c in chunks]
        print(f"[OK] Found {len(docs)} relevant chunks")
        
        if not docs:
            answer = "I couldn't find relevant information in the documents to answer your question."
        else:
            # Prepare context from documents
            context = "\n\n".join([doc["page_content"] for doc in docs])
            
            query_lower = query.lower()
            format_instruction = """

IMPORTANT formatting rules:
- Use GitHub-flavored Markdown with ## headings and bullet lists.
- Do not write paragraphs.
- Never summarize a paper as one Section/Content table.
- If you use a table (metrics only), each row must be on its own line with a header and |---|---| separator."""

            if "table" in query_lower:
                format_instruction = """

IMPORTANT: Include a proper markdown table (each row on its own line):
| Column Header 1 | Column Header 2 |
|---|---|
| Row 1 Col 1 | Row 1 Col 2 |

Also use headings and bullets around the table. Do not put the table on one line."""
            elif "bullet" in query_lower or "list" in query_lower:
                format_instruction = "\n\nIMPORTANT: Format your answer as a bullet-point list under short headings."
            elif "paragraph" in query_lower or "prose" in query_lower:
                format_instruction = "\n\nIMPORTANT: Format your answer as one cohesive paragraph."
            elif "detail" in query_lower or "detailed" in query_lower or "comprehensive" in query_lower:
                format_instruction = "\n\nIMPORTANT: Provide a detailed answer using headings, bullets, and a table only if it helps scan the facts."
            elif "brief" in query_lower or "concise" in query_lower or "short" in query_lower:
                format_instruction = "\n\nIMPORTANT: Keep your answer brief: a heading plus 3-5 bullets."
            elif "lines" in query_lower:
                import re
                match = re.search(r'(\d+)\s+lines?', query_lower)
                if match:
                    num_lines = match.group(1)
                    format_instruction = f"\n\nIMPORTANT: Provide your answer in exactly {num_lines} lines or fewer."
            
            # Create prompt with format enforcement
            prompt = PromptTemplate(
                input_variables=["context", "query"],
                template="""Based on the following context from documents, answer the question. If the answer is not in the context, say so.

Context:
{context}

Question: {query}""" + format_instruction + """

Answer:"""
            )
            
            print("[*] Creating LLM chain...")
            llm = get_llm()
            chain = prompt | llm
            
            print(f"[*] Invoking LLM with query: {query[:100]}...")
            response = chain.invoke({"context": context, "query": query})
            answer = response.content if hasattr(response, 'content') else str(response)
            print(f"[OK] Response received: {answer[:100]}...")
        
        sources = [
            {
                "chunk_id": str(chunk.id),
                "document_id": chunk.document_id,
            }
            for chunk in chunks
        ]

        session_db.add(
            ConversationMessage(
                conversation_id=conversation.id,
                role=ConversationMessageRole.USER,
                content=query,
            )
        )
        session_db.add(
            ConversationMessage(
                conversation_id=conversation.id,
                role=ConversationMessageRole.ASSISTANT,
                content=answer,
                sources=sources or None,
            )
        )
        if conversation.title is None:
            conversation.title = " ".join(query.split()[:6])[:80] or "New conversation"
        conversation.updated_at = datetime.utcnow()
        session_db.add(conversation)
        
        await session_db.commit()
        print("[OK] Messages saved to database")
        
        return answer, conversation.id
        
    except Exception as e:
        import traceback
        print(f"[!] Error in chat_with_documents: {str(e)}")
        print(traceback.format_exc())
        raise

