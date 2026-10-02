# Conversation persistence

Briefly stores authenticated chat history in PostgreSQL. Conversation history is separate from the existing document sessions used by the RAG index.

## Database

- `conversations`: UUID identity, owning `user_id`, optional title, and timestamps.
- `messages`: UUID identity, conversation foreign key with cascade delete, `user`/`assistant` role enum, content, optional JSONB `sources`, and creation timestamp.
- `user_id` and `conversation_id` indexes support sidebar and history queries.

Run the existing migration after deploying the code:

```bash
python backend/migrate_db.py
```

The Python `pgvector==0.2.5` client is pinned in `backend/requirements.txt`. The local Compose database uses `pgvector/pgvector:pg15`, which includes the PostgreSQL `vector` extension; `migrate_db.py` still runs `CREATE EXTENSION IF NOT EXISTS vector` so the extension is enabled in the target database.

The previous install failure was a PyPI download timeout. A fresh install succeeds with:

```bash
python -m pip install --no-cache-dir --default-timeout=120 pgvector==0.2.5
```

## API

All routes require `Authorization: Bearer <access_token>`.

- `POST /conversations` creates an empty conversation.
- `GET /conversations` lists the current user's conversations newest first.
- `GET /conversations/{id}` returns metadata and ordered messages.
- `POST /conversations/{id}/messages` appends one message and auto-titles from the first user message.
- `PATCH /conversations/{id}` renames a conversation.
- `DELETE /conversations/{id}` removes the conversation and its messages.

The document chat endpoint accepts an optional `conversation_id`. If omitted, it creates one. After retrieval and generation, it stores the user query and assistant answer, including retrieved chunk/document IDs in the assistant `sources` JSONB value, in one transaction.

This phase stores and reloads conversation history only. It does not implement cross-conversation memory or retrieval.
