import os
import json
import asyncio
import time
import logging
from typing import List, Tuple, Dict, Any
import requests
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel
from models import Chunk, Document, Session as DBSession
from config import ENABLE_SPARSE, RRF_K, CANDIDATE_COUNT, FINAL_TOP_N, MISTRAL_API_KEY, GROQ_API_KEY, GROQ_MODEL
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)

# ---------- Embedding ----------

def embed_query(query: str) -> List[float]:
    """Get embedding vector from Mistral embedding API."""
    res = embed_chunks([query])
    return res[0] if res else []

def embed_chunks(chunks: List[str]) -> List[List[float]]:
    """Get embedding vectors for a list of strings."""
    if not chunks:
        return []
    headers = {"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": "mistral-embed", "input": chunks}
    response = requests.post("https://api.mistral.ai/v1/embeddings", headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return [item["embedding"] for item in data["data"]]

# ---------- Retrieval ----------

async def dense_retrieve(session: AsyncSession, session_id: int, query_vec: List[float], top_k: int = 50) -> List[Chunk]:
    """Retrieve top_k chunks using pgvector cosine similarity."""
    sql = text(
        """
        SELECT * FROM chunk
        WHERE document_id IN (SELECT id FROM document WHERE session_id = :sid)
        ORDER BY embedding <#> :qvec
        LIMIT :limit
        """
    )
    result = await session.execute(sql, {"sid": session_id, "qvec": query_vec, "limit": top_k})
    return result.scalars().all()

async def sparse_retrieve(session: AsyncSession, session_id: int, query: str, top_k: int = 50) -> List[Chunk]:
    """Retrieve top_k chunks using PostgreSQL full‑text search (BM25 via ts_rank)."""
    sql = text(
        """
        SELECT * FROM chunk
        WHERE document_id IN (SELECT id FROM document WHERE session_id = :sid)
          AND tsv IS NOT NULL
        ORDER BY ts_rank(tsv, plainto_tsquery('english', :q)) DESC
        LIMIT :limit
        """
    )
    result = await session.execute(sql, {"sid": session_id, "q": query, "limit": top_k})
    return result.scalars().all()

def reciprocal_rank_fusion(dense: List[Chunk], sparse: List[Chunk], k: int = 60) -> List[Tuple[Chunk, float]]:
    """Merge two result sets using RRF. Returns list of (Chunk, score)."""
    scores: Dict[int, float] = {}
    for rank, chunk in enumerate(dense, start=1):
        scores[chunk.id] = scores.get(chunk.id, 0) + 1.0 / (k + rank)
    for rank, chunk in enumerate(sparse, start=1):
        scores[chunk.id] = scores.get(chunk.id, 0) + 1.0 / (k + rank)
    # Retrieve Chunk objects (unique) preserving original objects
    unique_chunks = {c.id: c for c in dense + sparse}
    fused = [(unique_chunks[cid], sc) for cid, sc in scores.items()]
    fused.sort(key=lambda x: x[1], reverse=True)
    return fused

# ---------- Reranking ----------

def rerank_chunks(query: str, chunks: List[Chunk], top_n: int = 5) -> List[Chunk]:
    """Rerank chunks with Groq LLM. Returns top_n chunks."""
    # Build context string
    context = "\n---\n".join([c.content for c in chunks])
    prompt_tpl = PromptTemplate(
        input_variables=["query", "context"],
        template=(
            "You are given a user query and several document snippets.\n"
            "Return a JSON array of objects with 'id' and a relevance score 0-10 for each snippet.\n"
            "Do not add any extra text.\n"
            "Query: {query}\n"
            "Snippets:\n{context}\n"
        ),
    )
    llm = ChatGroq(model=GROQ_MODEL, temperature=0, groq_api_key=GROQ_API_KEY)
    chain = prompt_tpl | llm
    resp = chain.invoke({"query": query, "context": context})
    try:
        data = json.loads(resp.content if hasattr(resp, "content") else str(resp))
    except Exception:
        logger.error("Reranker did not return valid JSON: %s", resp)
        return chunks[:top_n]
    # map id to score
    score_map = {item["id"]: float(item.get("score", 0)) for item in data}
    sorted_chunks = sorted(chunks, key=lambda c: score_map.get(c.id, 0), reverse=True)
    return sorted_chunks[:top_n]

# ---------- Orchestrator ----------

async def hybrid_retrieve(session: AsyncSession, session_id: int, query: str) -> List[Chunk]:
    """Perform hybrid retrieval and optional reranking, returning final Chunk list."""
    start = time.time()
    query_vec = embed_query(query)
    logger.info("Embedding latency: %.2f s", time.time() - start)

    dense = await dense_retrieve(session, session_id, query_vec, top_k=50)
    logger.info("Dense retrieval count: %d", len(dense))
    if ENABLE_SPARSE:
        sparse = await sparse_retrieve(session, session_id, query, top_k=50)
        logger.info("Sparse retrieval count: %d", len(sparse))
    else:
        sparse = []
    fused = reciprocal_rank_fusion(dense, sparse, k=RRF_K)
    top_candidates = [c for c, _ in fused[:CANDIDATE_COUNT]]
    logger.info("Fusion produced %d candidates", len(top_candidates))
    if top_candidates:
        final_chunks = rerank_chunks(query, top_candidates, top_n=FINAL_TOP_N)
    else:
        final_chunks = []
    logger.info("Hybrid retrieval completed, returning %d chunks", len(final_chunks))
    return final_chunks
