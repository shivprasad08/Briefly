# Getting Started - Context-Aware Meeting Assistant

## 📋 System Overview

This is a **production-ready RAG (Retrieval Augmented Generation) web application** that enables intelligent document management and AI-powered chat. Here's what it does:

### Core Features
✅ **Session Management** - Organize documents by topic  
✅ **PDF Upload & Parsing** - Automatic text extraction and chunking  
✅ **Vector Search** - FAISS-based semantic search on CPU  
✅ **AI Chat** - Ask questions and get answers based on documents  
✅ **Incremental Summaries** - Auto-generated summaries that evolve with new documents  
✅ **Chat History** - Persistent conversation tracking  

---

## 🛠️ Prerequisites

**Required:**
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- Groq API Key (free: https://console.groq.com)

**Recommended:**
- 4GB RAM
- 5GB disk space
- 50+ Mbps internet (for model downloads)

---

## 🚀 Complete Setup Guide

### Part 1: Get Groq API Key (5 minutes)

1. Go to https://console.groq.com
2. Sign up / Log in
3. Click "API Keys" in the left sidebar
4. Click "Create API Key"
5. Copy your key (starts with `gsk_`)
6. Keep it safe - you'll need it!

### Part 2: Clone/Create Project

```bash
# Navigate to where you want the project
cd d:\summary  # or your preferred location

# The project structure should look like:
# ├── backend/
# ├── frontend/
# ├── docker-compose.yml
# ├── README.md
# └── QUICKSTART.md
```

### Part 3: Start PostgreSQL Database

```bash
# From project root
docker-compose up -d

# Verify it's running
docker-compose ps

# Should show:
# meeting_assistant_db    postgres:15-alpine    Up (healthy)
```

### Part 4: Setup Backend

**Windows:**
```powershell
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "GROQ_API_KEY=gsk_your_key_here" > .env

# Initialize database
python init_db.py

# Run server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**macOS/Linux:**
```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "GROQ_API_KEY=gsk_your_key_here" > .env

# Initialize database
python init_db.py

# Run server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Verification:**
When running, you should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
```

### Part 5: Setup Frontend

**Windows:**
```powershell
# Open NEW PowerShell/Terminal window
cd frontend

# Install dependencies
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run development server
npm run dev
```

**macOS/Linux:**
```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run development server
npm run dev
```

**Verification:**
When running, you should see:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Part 6: Open the Application

1. Open your browser
2. Go to **http://localhost:3000**
3. You should see the Meeting Assistant dashboard

---

## ✅ Verify Everything Works

### Test 1: Create a Session
1. On the dashboard, enter a session name: "Test Session"
2. Click "Create Session"
3. You should see it appear in the grid

### Test 2: Access the Session
1. Click on "Test Session"
2. You should see a 3-pane layout:
   - **Left:** Documents (empty)
   - **Center:** Chat (empty)
   - **Right:** Summary (empty)

### Test 3: Upload a PDF
1. Click "Upload PDF" button
2. Select any PDF file (try a research paper or article)
3. Wait for upload to complete
4. You should see:
   - Document appears in left pane
   - Summary appears in right pane
   - No errors in terminal

### Test 4: Ask a Question
1. In the chat box, type: "What is this document about?"
2. Click Send button
3. Wait for response (may take 10-30 seconds on first query)
4. You should see:
   - Your question in the chat
   - AI response below it
   - No errors in terminal

**If all tests pass: 🎉 System is working perfectly!**

---

## 📂 Project Structure

```
meeting-assistant/
│
├── backend/                    # Python FastAPI application
│   ├── main.py                # FastAPI routes
│   ├── models.py              # Database schemas (SQLModel)
│   ├── database.py            # DB configuration
│   ├── service.py             # LangChain RAG logic
│   ├── config.py              # Configuration
│   ├── requirements.txt        # Python dependencies
│   ├── init_db.py             # Database initialization
│   ├── test_system.py         # System verification
│   ├── storage/               # Uploaded PDFs (auto-created)
│   ├── faiss_indexes/         # Vector indexes (auto-created)
│   ├── Dockerfile             # Production Docker image
│   └── .env.example           # Example environment file
│
├── frontend/                   # Next.js React application
│   ├── app/
│   │   ├── page.tsx           # Dashboard (/)
│   │   ├── layout.tsx         # Root layout
│   │   ├── globals.css        # Global styles
│   │   └── session/[id]/
│   │       └── page.tsx       # Session workspace
│   ├── components/            # Reusable components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Textarea.tsx
│   ├── lib/
│   │   └── api.ts             # API client
│   ├── package.json           # Node dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── tailwind.config.ts     # Tailwind CSS config
│   ├── postcss.config.js      # PostCSS config
│   ├── Dockerfile             # Production Docker image
│   └── .env.example           # Example environment file
│
├── docker-compose.yml         # Dev: PostgreSQL only
├── docker-compose.prod.yml    # Prod: All services
├── README.md                  # Full documentation
├── QUICKSTART.md              # Quick start guide
├── GETTING_STARTED.md         # This file
└── .gitignore                 # Git ignore file
```

---

## 🎯 How the System Works

### User Journey: Upload & Chat

1. **User creates session** → Session record in database
2. **User uploads PDF** → File saved locally
   - Text extracted with PyPDF
   - Split into 1000-char chunks (200-char overlap)
   - Converted to embeddings (HuggingFace)
   - Added to FAISS index
3. **Summary generated**
   - First upload: Creates initial summary
   - Later uploads: Merges new info with old summary
   - Considers recent chat for context
4. **User asks question**
   - Query converted to embedding
   - Top 5 similar chunks retrieved from FAISS
   - Groq LLM generates response
   - Q&A saved to chat history

### Data Flow

```
User (Frontend)
    ↓
API Request (Axios)
    ↓
FastAPI Routes (main.py)
    ↓
Service Layer (service.py)
    ├→ LangChain RAG
    ├→ Vector Store (FAISS)
    ├→ LLM (Groq)
    └→ Database (SQLModel + PostgreSQL)
    ↓
API Response
    ↓
React (Frontend)
```

---

## 🔧 Troubleshooting

### Backend Won't Start

**Error: `ModuleNotFoundError`**
- Solution: Ensure venv is activated
  ```bash
  venv\Scripts\activate  # Windows
  source venv/bin/activate  # Mac/Linux
  ```

**Error: `Connection refused` to database**
- Solution: Check Docker is running
  ```bash
  docker-compose ps
  docker-compose up -d  # If not running
  ```

**Error: `GROQ_API_KEY not set`**
- Solution: Create `.env` file in backend/
  ```bash
  echo "GROQ_API_KEY=gsk_your_key" > .env
  ```

### Frontend Won't Load

**Error: `Cannot GET /`**
- Solution: Ensure Next.js is running
  ```bash
  npm run dev  # From frontend/ directory
  ```

**Error: API connection errors in console**
- Solution: Check NEXT_PUBLIC_API_URL
  ```bash
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
  ```

### Upload Fails

**Error: File not uploading**
- Check file is actually a PDF
- Ensure backend is running
- Check browser console for errors

**Error: "Ingestion failed"**
- Check backend logs for details
- Verify PDF is valid (try different PDF)
- Check disk space in `backend/storage/`

### Chat Returns Error

**Error: "No documents uploaded"**
- You must upload at least one PDF before chatting
- Refresh page to see latest uploads

**Error: Slow responses (30+ seconds)**
- First query is slow (models loading)
- Groq API might be rate limited (30 req/min free tier)
- Check internet connection

---

## 📊 Key Technologies

| Component | Technology | Why? |
|-----------|-----------|------|
| Backend | FastAPI | Fast, async, built for APIs |
| Database | PostgreSQL | Reliable, great for structured data |
| Vector DB | FAISS | CPU-efficient, local storage |
| Embeddings | HuggingFace | Runs on CPU, high quality |
| LLM | Groq API | Fast inference, free tier available |
| Frontend | Next.js 14 | Modern React, great DX |
| Styling | Tailwind CSS | Utility-first, responsive |
| Animations | Framer Motion | Smooth UX animations |

---

## 💡 Tips & Tricks

### For Best Results
1. **Use clear PDFs** - OCR'd text works better than scanned
2. **Ask specific questions** - "What are the main points?" works better than "Tell me"
3. **Upload similar documents** - System handles context better
4. **Check summaries** - They update automatically after uploads

### For Development
1. **Enable hot reload** - Already enabled in both backends
2. **Check database directly**:
   ```bash
   psql -h localhost -U assistant_user -d meeting_assistant
   ```
3. **View API docs**: Go to http://localhost:8000/docs
4. **Check logs**: Both backends log to terminal

### For Production
1. **Use environment variables** - Never hardcode secrets
2. **Enable CORS properly** - Restrict to your domains
3. **Use managed database** - AWS RDS, Azure Database, etc.
4. **Deploy with Docker** - Use docker-compose.prod.yml
5. **Add authentication** - Protect your API and frontend

---

## 🚀 Next Steps

### Short Term
1. ✅ Get system working (this guide)
2. Test with your own documents
3. Explore the UI and features
4. Check database with PostgreSQL client

### Medium Term
1. Customize styling in `frontend/`
2. Add more components and features
3. Optimize for your use cases
4. Set up version control (git)

### Long Term
1. Deploy to production
2. Add user authentication
3. Implement real-time chat (WebSocket)
4. Add advanced features (branching, export, etc.)

---

## 📞 Support & Resources

### Docs
- [Full README.md](./README.md) - Complete documentation
- [FastAPI Docs](http://localhost:8000/docs) - Interactive API docs
- [Next.js Docs](https://nextjs.org/docs)
- [LangChain Docs](https://python.langchain.com/)

### Community
- Groq API: https://console.groq.com
- FastAPI: https://fastapi.tiangolo.com
- Next.js: https://nextjs.org
- LangChain: https://python.langchain.com/

### Issues
- Check backend logs (terminal window)
- Check browser console (F12)
- Check database (psql)
- Review .env files (.env and .env.local)

---

## 🎓 Learning Resources

### How RAG Works
RAG = Retrieval Augmented Generation
1. Store document chunks as vectors
2. Convert user query to vector
3. Find most similar chunks (retrieval)
4. Feed chunks + query to LLM (generation)
5. LLM generates answer based on context

### Key Concepts
- **Embeddings**: Convert text to numbers for similarity
- **FAISS**: Fast vector search library
- **Chunking**: Split text for better embeddings
- **LangChain**: Framework for LLM applications
- **Async**: Non-blocking I/O for speed

---

## ✨ What's Included

✅ Full-stack RAG application  
✅ Production-ready code  
✅ Docker setup (database)  
✅ Comprehensive documentation  
✅ Example environment files  
✅ Database initialization scripts  
✅ System verification scripts  
✅ Responsive UI with animations  

**Everything you need to build an AI document assistant!**

---

## 📝 License

MIT - Feel free to use, modify, and deploy!

---

**Good luck! 🚀 You've got this!**

Have questions? Check the logs, review the README, and don't hesitate to experiment!
