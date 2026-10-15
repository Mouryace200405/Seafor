from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings as env_settings
from .models import Setting

KEY = "app"

# These are NEVER stored in the DB; they are read from .env only.
SECRET_KEYS = {"api_key", "gemini_api_key", "groq_api_key", "ollama_base_url"}

DEFAULTS: dict = {
    "default_model": "ollama/lfm2.5:latest",
    "system_prompt": "You are Seafor, a fast, concise and precise assistant. Answer clearly and stay accurate; never invent facts or sources.",
    "temperature": 0.7,
    "max_tokens": 0,
    "tts_voice": "",
    "tts_rate": 1.0,
    "auto_tts": False,
    "context_fraction": 0.72,
    # EFT voting mode
    "voting_models": [
        "groq/openai/gpt-oss-20b",
        "ollama/lfm2.5:latest",
        "ollama/ministral-3:3b",
    ],
    "voting_consistency": "majority",
    "voting_permutation": "cyclic",
    "voting_min_votes": 1,
    "voting_tie_break": "random",
    # EFT dictatorship mode
    "dictatorship_generators": [
        "groq/openai/gpt-oss-20b",
        "ollama/lfm2.5:latest",
        "ollama/ministral-3:3b",
    ],
    "dictatorship_judge": "groq/openai/gpt-oss-120b",
    # EFT routing mode
    "routing_submode": "llm",
    "routing_router_model": "ollama/qwen3.5:4b",
    "routing_decision_model": "ollama/tev1:4b",
    "routing_models": {
        "coder": "groq/openai/gpt-oss-20b",
        "multimodal": "",
        "reasoning": "groq/openai/gpt-oss-120b",
        "rag": "groq/openai/gpt-oss-20b",
        "general": "groq/openai/gpt-oss-20b",
    },
}


async def get_app_settings(session: AsyncSession) -> dict:
    row = await session.get(Setting, KEY)
    data = dict(DEFAULTS)
    if row and isinstance(row.value, dict):
        data.update({
            k: v
            for k, v in row.value.items()
            if v is not None and k not in SECRET_KEYS
        })
    # All keys from .env only
    env = env_settings()
    data["api_key"] = getattr(env, "openrouter_api_key", "") or ""
    data["gemini_api_key"] = getattr(env, "gemini_api_key", "") or ""
    data["groq_api_key"] = getattr(env, "groq_api_key", "") or ""
    data["ollama_base_url"] = getattr(env, "ollama_base_url", "") or "http://localhost:11434"
    return data


async def update_app_settings(session: AsyncSession, updates: dict) -> dict:
    row = await session.get(Setting, KEY)
    stored = dict(DEFAULTS)
    if row and isinstance(row.value, dict):
        stored.update({
            k: v
            for k, v in row.value.items()
            if v is not None and k not in SECRET_KEYS
        })
    for key, value in updates.items():
        if value is not None and key not in SECRET_KEYS:
            stored[key] = value
    if row is None:
        row = Setting(key=KEY, value=stored)
        session.add(row)
    else:
        row.value = stored
    await session.commit()
    return await get_app_settings(session)