from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import memory as mem
from ..database import get_session
from ..models import Memory
from ..schemas import MemoryCreate, MemoryOut, MemoryUpdate

router = APIRouter(prefix="/api/memories", tags=["memories"])


@router.get("", response_model=list[MemoryOut])
async def list_memories(session: AsyncSession = Depends(get_session)):
    rows = await session.execute(
        select(Memory).order_by(Memory.pinned.desc(), Memory.updated_at.desc())
    )
    return list(rows.scalars().all())


@router.post("", response_model=MemoryOut)
async def create_memory(payload: MemoryCreate, session: AsyncSession = Depends(get_session)):
    memory = await mem.add(
        session,
        content=payload.content,
        kind=payload.kind,
        pinned=payload.pinned,
        dedupe=False,
    )
    if memory is None:
        raise HTTPException(400, "Empty memory")
    await session.commit()
    await session.refresh(memory)
    return memory


@router.patch("/{memory_id}", response_model=MemoryOut)
async def update_memory(
    memory_id: uuid.UUID, payload: MemoryUpdate, session: AsyncSession = Depends(get_session)
):
    memory = await session.get(Memory, memory_id)
    if not memory:
        raise HTTPException(404, "Memory not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(memory, key, value)
    await session.commit()
    await session.refresh(memory)
    return memory


@router.delete("/{memory_id}")
async def delete_memory(memory_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    memory = await session.get(Memory, memory_id)
    if not memory:
        raise HTTPException(404, "Memory not found")
    await session.delete(memory)
    await session.commit()
    return {"ok": True}


@router.delete("")
async def clear_memories(session: AsyncSession = Depends(get_session)):
    await session.execute(delete(Memory))
    await session.commit()
    return {"ok": True}
