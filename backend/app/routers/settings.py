from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings as env_settings
from ..database import get_session
from ..schemas import SettingsOut, SettingsUpdate
from ..settings_store import get_app_settings, update_app_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _to_out(data: dict) -> SettingsOut:
    key = data.get("api_key") or ""
    gemini_key = data.get("gemini_api_key") or ""
    groq_key = data.get("groq_api_key") or ""
    return SettingsOut(
        has_api_key=bool(key),
        api_key_hint=(f"...{key[-4:]}" if len(key) >= 4 else ""),
        gemini_api_key_hint=(f"...{gemini_key[-4:]}" if len(gemini_key) >= 4 else ""),
        groq_api_key_hint=(f"...{groq_key[-4:]}" if len(groq_key) >= 4 else ""),
        default_model=data.get("default_model", ""),
        system_prompt=data.get("system_prompt", ""),
        temperature=data.get("temperature", 0.7),
        max_tokens=data.get("max_tokens", 0),
        tts_voice=data.get("tts_voice", ""),
        tts_rate=data.get("tts_rate", 1.0),
        auto_tts=data.get("auto_tts", False),
        context_fraction=data.get("context_fraction", 0.72),
        openrouter_configured_via_env=bool(env_settings().openrouter_api_key),
        gemini_configured_via_env=bool(env_settings().gemini_api_key),
        groq_configured_via_env=bool(env_settings().groq_api_key),
    )


@router.get("", response_model=SettingsOut)
async def read_settings(session: AsyncSession = Depends(get_session)):
    return _to_out(await get_app_settings(session))


@router.put("", response_model=SettingsOut)
async def write_settings(payload: SettingsUpdate, session: AsyncSession = Depends(get_session)):
    updates = payload.model_dump(exclude_none=True)
    data = await update_app_settings(session, updates)
    return _to_out(data)