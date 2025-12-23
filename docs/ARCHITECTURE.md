# Architecture & System Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER BROWSER (Frontend)                      │
│                      Next.js 14 React App                        │
│                      http://localhost:3000                       │
│  ┌─────────────┬──────────────┬─────────────────────────────────┐
│  │ Documents   │ Chat         │ Summary (Markdown)              │
│  │ List        │ Interface    │ Auto-updated                    │
│  │ Upload      │ Auto-scroll  │ Shows current summary           │
│  └─────────────┴──────────────┴─────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
                            ↓↑
                      HTTP/REST API
                      (Axios Client)
                            ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Python FastAPI)                        │
│                  http://localhost:8000                           │
│  ┌─────────────────────────────────────────────────────────────┐
│  │ Routes (main.py)                                            │
│  │ • POST /sessions/{id}/upload     → Ingest PDF              │
│  │ • POST /sessions/{id}/chat       → RAG Query               │
│  │ • GET  /sessions/{id}/documents  → List docs               │
│  │ • GET  /sessions/{id}/messages   → Chat history            │
│  └─────────────────────────────────────────────────────────────┘
│  ┌─────────────────────────────────────────────────────────────┐
│  │ Service Layer (service.py)                                  │
│  │ • extract_text_from_pdf()       → PyPDF                    │
│  │ • ingest_pdf()                  → FAISS + Summary          │
│  │ • chat_with_documents()         → RAG + Chat history       │
│  └─────────────────────────────────────────────────────────────┘
│  ┌──────────────────┬──────────────────┬──────────────────────┐
│  │ FAISS Index      │ HuggingFace      │ Groq LLM             │
│  │ (Vector Store)   │ Embeddings       │ (llama-3.1-8b)       │
│  │ CPU-based        │ (CPU-efficient)  │ API-based            │
│  │ Local storage    │                  │                      │
│  └──────────────────┴──────────────────┴──────────────────────┘
└─────────────────────────────────────────────────────────────────┘
        ↓↑                                        ↓↑
      DATABASE                              EXTERNAL APIs
      PostgreSQL                            Groq API
      (localhost:5432)                      (Groq Cloud)
      ┌──────────────┐
      │ Sessions     │
      │ Documents    │
      │ ChatMessages │
      └──────────────┘
```

## Data Flow: Document Upload

```
User selects PDF file
         ↓
[Frontend] Sends multipart/form-data
         ↓
[FastAPI] Receives at POST /sessions/{id}/upload
         ↓
Validate file (is PDF?)
         ↓
Save to disk: backend/storage/session_{id}_{filename}
         ↓
Create Document record in DB
         ↓
[Service] extract_text_from_pdf()
         ↓
Split into chunks (1000 chars, 200 overlap)
         ↓
[HuggingFace] Convert chunks → embeddings (384-dim vectors)
         ↓
Load existing FAISS index OR create new one
         ↓
Add embeddings to FAISS index
         ↓
Save index to: backend/faiss_indexes/session_{id}/
         ↓
[Groq] Generate summary of new document text
         ↓
Fetch previous summary from DB
         ↓
Fetch last 5 chat messages for context
         ↓
[Groq] Refine: Integrate new summary + old summary + context
         ↓
Update Session.current_summary in DB
         ↓
[Frontend] Receives success response
         ↓
✅ Summary appears in right pane
```

## Data Flow: Chat with Documents

```
User types question & clicks Send
         ↓
[Frontend] Sends POST /sessions/{id}/chat {"query": "..."}
         ↓
[FastAPI] Receives at POST /sessions/{id}/chat
         ↓
Load FAISS index for session
         ↓
[HuggingFace] Convert user query → embedding (384-dim)
         ↓
[FAISS] Search index for top 5 most similar chunks
         ↓
Retrieve 5 document chunks with highest similarity
         ↓
Create prompt: "{chunks} Answer this: {user_query}"
         ↓
[Groq] Generate response using LLM
         ↓
Save ChatMessage (role="user", content=query) to DB
         ↓
Save ChatMessage (role="assistant", content=response) to DB
         ↓
[Frontend] Receives {"response": "..."}
         ↓
✅ Messages appear in chat pane, auto-scroll to bottom
```

## Database Schema

```sql
-- Session: Represents a meeting/topic
CREATE TABLE session (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    current_summary TEXT,  -- Evolving summary
    faiss_index_path VARCHAR(512),  -- Path to .index file
    created_at TIMESTAMP DEFAULT now()
);

-- Document: Uploaded PDF files
CREATE TABLE document (
    id INTEGER PRIMARY KEY,
    session_id INTEGER FOREIGN KEY,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,  -- Local storage path
    upload_timestamp TIMESTAMP DEFAULT now()
);

-- ChatMessage: User questions and AI responses
CREATE TABLE chatmessage (
    id INTEGER PRIMARY KEY,
    session_id INTEGER FOREIGN KEY,
    role VARCHAR(20) NOT NULL,  -- "user" or "assistant"
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT now()
);
```

## Vector Store Strategy

### FAISS Index Structure
```
FAISS Index (Per Session)
├── Documents metadata
├── Vector embeddings (384 dimensions)
│   ├── Chunk 1 → [0.12, 0.45, 0.78, ..., 0.34]
│   ├── Chunk 2 → [0.11, 0.46, 0.79, ..., 0.33]
│   ├── Chunk 3 → [0.13, 0.44, 0.77, ..., 0.35]
│   └── ...
└── Similarity index (for fast search)

When query comes:
1. Convert query → [0.12, 0.45, 0.78, ..., 0.34]
2. Find closest vectors using cosine similarity
3. Return top 5 chunks and content
```

### Incremental Index Updates
```
First Upload:
session.faiss_index_path = None
→ Create new FAISS index from scratch
→ Add all chunks
→ Save to backend/faiss_indexes/session_1/

Second Upload:
session.faiss_index_path = "backend/faiss_indexes/session_1/"
→ Load existing index
→ Add new chunks to existing index
→ Save updated index (overwrites)
→ FAISS handles incremental updates automatically
```

## Summary Refinement Chain

```
Old Summary:
"Session discusses Q3 results and 2024 planning..."

New Document Summary:
"Marketing strategy for new product launch in 2024..."

Recent Context (Last 5 messages):
"User: What about marketing?"
"Assistant: Based on the documents..."
"User: Any new product plans?"
...

LLM Refines:
Prompt: "Integrate new info into old summary. Consider recent questions."

Refined Summary:
"Session covers Q3 results, 2024 planning WITH ADDED: 
 Marketing strategy for new product launch. Recent discussion 
 focused on marketing timeline and budget allocation."
```

## Key Design Decisions

### 1. FAISS for Vector Store
✅ Runs on CPU (no GPU needed)  
✅ Extremely fast similarity search  
✅ Easy local storage  
✅ Works offline after initial setup  
✅ Scales to millions of vectors  

### 2. Groq API for LLM
✅ Fast inference (ideal for real-time)  
✅ Free tier available  
✅ No local GPU requirement  
✅ Easy to integrate (LangChain support)  
✅ No model download/storage needed  

### 3. PostgreSQL for Storage
✅ ACID compliance for data safety  
✅ Great for structured data  
✅ Scales well  
✅ Good integration with SQLModel  
✅ Docker makes setup trivial  

### 4. Async/Await Throughout
✅ Non-blocking I/O  
✅ Better resource utilization  
✅ Handles many concurrent users  
✅ Smoother UI (no blocking)  

### 5. Incremental Summaries
✅ Preserves context from previous docs  
✅ Considers user intent (recent chat)  
✅ More coherent as sessions grow  
✅ Reduces hallucination  

## Performance Characteristics

### Latencies
| Operation | Time | Bottleneck |
|-----------|------|-----------|
| Upload & parse PDF | 2-5s | PyPDF processing |
| Generate initial summary | 5-10s | Groq API (network) |
| Refine summary | 3-7s | Groq API (network) |
| Chat query | 8-15s | FAISS search + Groq |
| Chat (subsequent) | 5-12s | Groq faster (cached) |

### Resource Usage
| Resource | Typical | Peak |
|----------|---------|------|
| Memory | 200MB | 500MB (during upload) |
| CPU | 5% | 15% (chunking) |
| Disk | ~100MB/session | Depends on docs |
| Network | 10MB/day | Per query (small) |

### Scaling Limits
| Metric | Limit | Solution |
|--------|-------|----------|
| Docs/session | 1000+ | FAISS handles |
| Chat history | 10,000+ messages | Paginate |
| Sessions | 1000+ | Database scales |
| Concurrent users | 10-50 | Add backend instances |

## Security Considerations

### Current Implementation
- No authentication (prototype)
- CORS allows all origins
- Files stored locally (accessible)
- API key in environment variable

### Production Recommendations
1. **Authentication**: Add JWT/OAuth
2. **CORS**: Restrict to your domains
3. **File Security**: Encrypt PDFs, limit access
4. **API Keys**: Use secrets manager
5. **Database**: SSL connections, backups
6. **Rate Limiting**: Prevent abuse
7. **Input Validation**: Sanitize queries
8. **Logging**: Audit trail for compliance

## Monitoring & Observability

### Metrics to Track
```
Frontend:
- Page load time
- API response time
- Error rates
- User interactions

Backend:
- Request latency
- Error rates
- Database queries
- FAISS search time
- Groq API calls

Database:
- Query time
- Connection pool usage
- Disk usage
- Backup success

Infrastructure:
- CPU/Memory usage
- Disk I/O
- Network traffic
```

### Logging
```
# View backend logs (terminal running uvicorn)
# View frontend logs (browser console or next.js terminal)
# View database logs:
docker-compose logs postgres
```

## Deployment Architecture

```
Production Setup:
┌──────────────┐
│   Vercel     │  ← Next.js Frontend
└──────────────┘
      ↓
┌──────────────┐
│   AWS/Azure  │  ← FastAPI Backend (Gunicorn + Uvicorn)
└──────────────┘
      ↓
┌──────────────┐
│ AWS RDS      │  ← PostgreSQL (Managed)
└──────────────┘
      ↓
┌──────────────┐
│ S3 Bucket    │  ← PDF Storage (Scalable)
└──────────────┘
      ↓
┌──────────────┐
│ Groq API     │  ← Hosted LLM
└──────────────┘
```

---

## References

- [FAISS Documentation](https://github.com/facebookresearch/faiss)
- [LangChain RAG](https://python.langchain.com/docs/use_cases/qa_over_docs/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/docs)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [HuggingFace](https://huggingface.co/)
