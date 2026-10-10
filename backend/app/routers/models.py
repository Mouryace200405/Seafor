from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..openrouter import list_models
from ..settings_store import get_app_settings

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models(session: AsyncSession = Depends(get_session)):
    data = await get_app_settings(session)
    try:
        models = await list_models(data.get("api_key") or None)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Could not reach OpenRouter: {exc}") from exc
    return {"data": models}
