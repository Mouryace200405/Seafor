from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..providers import Provider, list_models
from ..settings_store import get_app_settings

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models(provider: str | None = Query(None), session: AsyncSession = Depends(get_session)):
    data = await get_app_settings(session)
    try:
        prov = Provider(provider.lower()) if provider else None
        models = await list_models(
            data.get("api_key"),
            data.get("gemini_api_key"),
            data.get("groq_api_key"),
            prov,
            data.get("ollama_base_url"),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Could not fetch models: {exc}") from exc
    return {"data": models}