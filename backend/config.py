"""
Development environment configuration.
Load this to set up environment variables for local development.
"""

import os
from dotenv import load_dotenv

# Load .env file from backend directory
load_dotenv()

# Validate required environment variables
# Switching back to Groq; require GROQ_API_KEY
REQUIRED_VARS = ["GROQ_API_KEY"]

missing_vars = [var for var in REQUIRED_VARS if not os.getenv(var)]
if missing_vars:
    print(f"[!] Missing environment variables: {', '.join(missing_vars)}")
    print("    Please create a .env file in backend/ with these variables:")
    for var in missing_vars:
        print(f"    {var}=your_value_here")

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://assistant_user:secure_password_123@localhost:5432/meeting_assistant"
)

# Groq LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Default to a fast, inexpensive Groq model; change if you prefer
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# Vector Store
EMBEDDINGS_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
RETRIEVAL_K = 5

# LLM Parameters
LLM_TEMPERATURE = 0.7

# Hybrid Retrieval Config (env vars with defaults)
ENABLE_SPARSE = os.getenv("ENABLE_SPARSE", "true").lower() == "true"
RRF_K = int(os.getenv("RRF_K", "60"))
CANDIDATE_COUNT = int(os.getenv("CANDIDATE_COUNT", "20"))
FINAL_TOP_N = int(os.getenv("FINAL_TOP_N", "5"))

# External services
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

print("[OK] Environment configured successfully")
