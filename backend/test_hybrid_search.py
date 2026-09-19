import pytest
import asyncio
from unittest.mock import patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from models import Chunk

# We will mock the DB session and embed_query
from hybrid_search import reciprocal_rank_fusion, rerank_chunks

@pytest.fixture
def mock_chunks():
    chunks = []
    for i in range(1, 11):
        c = Chunk(id=i, document_id=1, content=f"Chunk {i} content")
        chunks.append(c)
    return chunks

def test_reciprocal_rank_fusion(mock_chunks):
    dense = mock_chunks[:5]  # 1, 2, 3, 4, 5
    sparse = mock_chunks[3:8] # 4, 5, 6, 7, 8
    
    # 4 and 5 are in both
    fused = reciprocal_rank_fusion(dense, sparse, k=60)
    
    # Expected: 4 and 5 should have higher scores because they appear in both lists
    fused_ids = [c.id for c, score in fused]
    
    assert len(fused) == 8
    assert 4 in fused_ids[:2]
    assert 5 in fused_ids[:2]

@patch("hybrid_search.ChatGroq")
def test_rerank_chunks(mock_chatgroq, mock_chunks):
    # Mock LLM response returning JSON
    mock_llm_instance = MagicMock()
    mock_resp = MagicMock()
    mock_resp.content = '[{"id": 1, "score": 9.5}, {"id": 2, "score": 2.0}, {"id": 3, "score": 8.0}]'
    mock_llm_instance.invoke.return_value = mock_resp
    
    # Mock the chain `prompt_tpl | llm` which is what gets invoked
    with patch("hybrid_search.PromptTemplate") as mock_prompt:
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = mock_resp
        mock_prompt.return_value.__or__.return_value = mock_chain
        
        candidates = mock_chunks[:3]
        reranked = rerank_chunks("test query", candidates, top_n=2)
        
        # Should return chunks with id 1 and 3
        assert len(reranked) == 2
        assert reranked[0].id == 1
        assert reranked[1].id == 3

# Testing the async retrieval would require more complex DB mocking, 
# so we focus on the fusion and reranking logic which are the core algorithmic additions.
