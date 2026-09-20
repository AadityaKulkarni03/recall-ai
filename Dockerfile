# ── Backend (FastAPI + Moss) ─────────────────────────────────────
FROM python:3.13-slim AS backend

WORKDIR /app

# System deps for Moss native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
