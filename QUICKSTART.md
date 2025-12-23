# Context-Aware Meeting Assistant - Quick Start Guide

This guide will get you up and running in 5 minutes.

## Prerequisites Checklist
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Docker & Docker Compose installed
- [ ] Groq API key (free at https://console.groq.com)

## Quick Start (Windows)

### Step 1: Start Database (1 min)
```powershell
docker-compose up -d
```

### Step 2: Setup & Run Backend (2 min)
```powershell
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your Groq API key
echo "GROQ_API_KEY=your_key_here" > .env

# Run backend
python -m uvicorn main:app --reload
```

### Step 3: Setup & Run Frontend (2 min)
```powershell
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Step 4: Access the App
- Open http://localhost:3000
- Create a session
- Upload a PDF
- Chat with your documents!

## Quick Start (macOS/Linux)

```bash
# Database
docker-compose up -d

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "GROQ_API_KEY=your_key_here" > .env
python -m uvicorn main:app --reload

# Frontend (in new terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## What Can You Do?

1. **Create Sessions** - Organize documents by topic
2. **Upload PDFs** - Automatically parsed and indexed
3. **Ask Questions** - Chat with your documents using AI
4. **Get Summaries** - Auto-generated and updated with each upload

## API is Running When You See

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## Frontend is Running When You See

```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

## Test the System

1. Create a "Test Session"
2. Upload a PDF (try a research paper or article)
3. Wait for upload to complete
4. Ask: "What is this document about?"
5. Watch the AI respond with context!

## Common Issues

| Issue | Fix |
|-------|-----|
| Port 5432 already in use | `docker-compose down` first, or use different port |
| `ModuleNotFoundError` | Ensure venv is activated |
| API connection error | Check backend is running on :8000 |
| Groq API error | Verify API key in .env |

## Next Steps

- Read [README.md](../README.md) for detailed documentation
- Explore the 3-pane UI (Documents, Chat, Summary)
- Try uploading multiple documents to see summary evolution
- Check database with: `psql -h localhost -U assistant_user -d meeting_assistant`

## Need Help?

- Check backend logs for errors
- Verify Groq API key validity
- Ensure Docker container is healthy: `docker-compose ps`
- Check database connection: `psql -h localhost -U assistant_user`
