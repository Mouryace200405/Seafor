from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Prompt
from ..schemas import PromptCreate, PromptOut, PromptUpdate

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("", response_model=list[PromptOut])
async def list_prompts(session: AsyncSession = Depends(get_session)):
    rows = await session.execute(select(Prompt).order_by(Prompt.updated_at.desc()))
    return list(rows.scalars().all())


@router.post("", response_model=PromptOut)
async def create_prompt(payload: PromptCreate, session: AsyncSession = Depends(get_session)):
    prompt = Prompt(title=payload.title, content=payload.content)
    session.add(prompt)
    await session.commit()
    await session.refresh(prompt)
    return prompt


@router.patch("/{prompt_id}", response_model=PromptOut)
async def update_prompt(prompt_id: uuid.UUID, payload: PromptUpdate, session: AsyncSession = Depends(get_session)):
    prompt = await session.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(prompt, key, value)
    await session.commit()
    await session.refresh(prompt)
    return prompt


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    prompt = await session.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    await session.delete(prompt)
    await session.commit()
    return {"ok": True}
