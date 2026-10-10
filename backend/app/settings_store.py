from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings as env_settings
from .models import Setting

KEY = "app"

DEFAULTS: dict = {
    "api_key": "",
    "default_model": "cohere/north-mini-code:free",
    "system_prompt": "You are chati, a fast, concise and precise assistant. Answer clearly and stay accurate; never invent facts or sources.",
    "temperature": 0.7,
    "max_tokens": 0,
    "tts_voice": "",
    "tts_rate": 1.0,
    "auto_tts": False,
    "context_fraction": 0.72,
}


async def get_app_settings(session: AsyncSession) -> dict:
    row = await session.get(Setting, KEY)
    data = dict(DEFAULTS)
    if row and isinstance(row.value, dict):
        data.update({k: v for k, v in row.value.items() if v is not None})
    if not data.get("api_key"):
        data["api_key"] = env_settings().openrouter_api_key or ""
    return data


async def update_app_settings(session: AsyncSession, updates: dict) -> dict:
    data = await get_app_settings(session)
    for key, value in updates.items():
        if value is not None:
            data[key] = value
    row = await session.get(Setting, KEY)
    if row is None:
        row = Setting(key=KEY, value=data)
        session.add(row)
    else:
        row.value = data
    await session.commit()
    return data
