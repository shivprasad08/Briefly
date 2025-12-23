# Context-Aware Meeting Assistant

A production-ready RAG (Retrieval Augmented Generation) web application that allows users to manage sessions, upload PDF documents, and chat with an AI assistant powered by Groq's Llama model.

## Project Structure

```
meeting-assistant/
├── backend/
│   ├── models.py              # SQLModel database schemas
│   ├── database.py            # Database configuration
│   ├── service.py             # LangChain RAG logic
│   ├── main.py                # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   ├── storage/               # Uploaded PDF storage
│   └── faiss_indexes/         # Vector store indexes
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Dashboard with sessions grid
│   │   ├── layout.tsx         # Root layout
│   │   ├── globals.css        # Global styles
│   │   └── session/[id]/
│   │       └── page.tsx       # Session workspace (3-pane layout)
│   ├── components/            # Reusable UI components
│   ├── lib/
│   │   └── api.ts             # API client
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml         # PostgreSQL database
└── README.md
```

## Tech Stack

### Backend
- **Framework:** FastAPI (async Python)
- **Database:** PostgreSQL with SQLModel ORM
- **Vector Store:** FAISS (CPU-based)
- **Embeddings:** HuggingFace (`sentence-transformers/all-MiniLM-L6-v2`)
- **LLM:** Groq API (`llama-3.1-8b-instant`)
- **PDF Processing:** PyPDF
- **RAG Framework:** LangChain

### Frontend
- **Framework:** Next.js 14 
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **API Client:** Axios
- **Icons:** Lucide React
- **Markdown:** React Markdown

## Prerequisites

- Python 3.11+
- Node.js 18+ 
- Docker & Docker Compose (for PostgreSQL)
- Groq API key ([Get it here](https://console.groq.com))

## Setup Instructions

### 1. Start PostgreSQL Database

```bash
docker-compose up -d
```

This creates a PostgreSQL container named `meeting_assistant_db` on port 5432.

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

Create a `.env` file in the `backend/` directory:

```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=postgresql+asyncpg://assistant_user:secure_password_123@localhost:5432/meeting_assistant
```

### 4. Start Backend Server

```bash
# From backend directory
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

### 6. Start Frontend Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### Document Ingestion Pipeline

1. **Upload:** User uploads a PDF via the frontend
2. **Parse:** Backend extracts text using PyPDF
3. **Chunk:** Text is split into 1000-character chunks with 200-character overlap
4. **Embed:** Chunks are converted to vectors using HuggingFace embeddings
5. **Index:** Vectors are added to FAISS index (creates if doesn't exist)
6. **Summarize:** LLM generates summary of new document
7. **Refine:** New summary is merged with existing summary using context from recent chat messages
8. **Store:** Updated summary and index path saved to database

### Chat with Documents

1. **Query:** User sends a question
2. **Retrieve:** Most similar document chunks retrieved from FAISS (top 5)
3. **Generate:** Groq LLM generates response based on retrieved chunks
4. **Store:** User query and AI response saved to chat history

### Incremental Summary Updates

The system maintains a `current_summary` field that evolves as new documents are added:
- Each new PDF gets its own summary
- The "Refine Chain" integrates new information with old summary
- Recent chat context is considered to highlight relevant details
- Conflicts are resolved intelligently
- Redundancies are removed

## API Endpoints

### Sessions
- `GET /sessions` - List all sessions
- `POST /sessions` - Create new session
- `GET /sessions/{id}` - Get session details
- `GET /sessions/{id}/documents` - List documents in session
- `GET /sessions/{id}/messages` - Get chat history

### Document Management
- `POST /sessions/{id}/upload` - Upload PDF file

### Chat
- `POST /sessions/{id}/chat` - Send query

### Health
- `GET /health` - Health check

## Frontend Features

### Dashboard (`/`)
- Grid view of all sessions
- Create new session
- Quick access to session summaries
- Responsive design with animations

### Session Workspace (`/session/[id]`)
- **Left Pane:** Document list with upload button
- **Center Pane:** Chat interface with message history
- **Right Pane:** Live summary with markdown rendering
- Real-time updates via polling (5-second interval)
- Smooth animations and transitions

## Configuration

### Model Parameters

In `backend/service.py`:
```python
# Chunking
chunk_size=1000
chunk_overlap=200

# LLM
temperature=0.7
model="llama-3.1-8b-instant"

# Retrieval
k=5  # Top 5 similar chunks
```

### Database

Default connection string in `backend/database.py`:
```
postgresql+asyncpg://assistant_user:secure_password_123@localhost:5432/meeting_assistant
```

Override with `DATABASE_URL` environment variable.

## Performance Considerations

### CPU Optimization
- HuggingFace embeddings run efficiently on CPU
- FAISS-CPU for vector search
- Groq API offloads LLM computation
- Async/await throughout for non-blocking I/O

### Scaling
- FAISS supports incremental index updates
- PostgreSQL handles large chat histories
- Frontend polling can be replaced with WebSockets
- Vector store can be distributed across sessions

## Troubleshooting

### Database Connection Failed
- Ensure Docker container is running: `docker-compose ps`
- Check credentials in `.env` match `docker-compose.yml`
- Test connection: `psql -h localhost -U assistant_user -d meeting_assistant`

### Groq API Errors
- Verify API key in `.env` is correct
- Check Groq API status
- Monitor rate limits (free tier: 30 req/min)

### FAISS Index Errors
- Ensure `backend/faiss_indexes/` directory is writable
- Check disk space for large indexes
- Recreate index by re-uploading documents

### Frontend API Errors
- Verify backend is running on correct port
- Check CORS configuration in `backend/main.py`
- Inspect browser console for detailed errors

## Deployment

### Backend (Production)
```bash
# Use Gunicorn with Uvicorn workers
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Or use Docker
docker build -t meeting-assistant-backend .
docker run -p 8000:8000 -e GROQ_API_KEY=xxx meeting-assistant-backend
```

### Frontend (Vercel/Netlify)
```bash
npm run build
npm start
```

### Database (Production)
- Use managed PostgreSQL (AWS RDS, Azure Database, etc.)
- Update `DATABASE_URL` environment variable
- Enable SSL for connections

## Future Enhancements

- [ ] WebSocket for real-time chat
- [ ] User authentication and multi-user support
- [ ] Document search and filtering
- [ ] Export summaries as PDF/Word
- [ ] Conversation branching
- [ ] Custom LLM model selection
- [ ] Session templates
- [ ] Advanced analytics dashboard
- [ ] Document OCR for scanned PDFs
- [ ] Multi-language support

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
