"""Centralised config — reads .env once and exposes typed settings."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

MOSS_PROJECT_ID: str = os.environ["MOSS_PROJECT_ID"]
MOSS_PROJECT_KEY: str = os.environ["MOSS_PROJECT_KEY"]
GROQ_API_KEY: str = os.environ["GROQ_API_KEY"]
DEEPGRAM_API_KEY: str = os.environ.get("DEEPGRAM_API_KEY", "")

# Defaults
GROQ_LLM_MODEL: str = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-20b")
GROQ_STT_MODEL: str = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
MOSS_SESSION_NAME: str = os.getenv("MOSS_SESSION_NAME", "recall-session")
TOP_K: int = int(os.getenv("TOP_K", "5"))
