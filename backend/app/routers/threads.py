from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Artifact, Message, Thread
from ..schemas import MessageOut, ThreadCreate, ThreadOut, ThreadUpdate
from ..skills import default_enabled_skills

router = APIRouter(prefix="/api/threads", tags=["threads"])


async def _decorate(session: AsyncSession, threads: list[Thread]) -> list[ThreadOut]:
    if not threads:
        return []
    ids = [t.id for t in threads]

    counts = dict(
        (await session.execute(
            select(Message.thread_id, func.count(Message.id)).where(Message.thread_id.in_(ids)).group_by(Message.thread_id)
        )).all()
    )

    previews: dict[uuid.UUID, str] = {}
    last_rows = await session.execute(
        select(Message.thread_id, Message.content, Message.role)
        .where(Message.thread_id.in_(ids))
        .distinct(Message.thread_id)
        .order_by(Message.thread_id, Message.created_at.desc())
    )
    for tid, content, role in last_rows.all():
        previews[tid] = (f"You: {content}" if role == "user" else content)[:120]

    out = []
    for t in threads:
        item = ThreadOut.model_validate(t)
        item.message_count = counts.get(t.id, 0)
        item.preview = previews.get(t.id, "")
        out.append(item)
    return out


@router.get("", response_model=list[ThreadOut])
async def list_threads(
    search: str | None = None,
    include_archived: bool = False,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Thread)
    if not include_archived:
        stmt = stmt.where(Thread.archived.is_(False))
    if search:
        stmt = stmt.where(Thread.title.ilike(f"%{search}%"))
    stmt = stmt.order_by(Thread.pinned.desc(), Thread.updated_at.desc())
    threads = list((await session.execute(stmt)).scalars().all())
    return await _decorate(session, threads)


@router.post("", response_model=ThreadOut)
async def create_thread(payload: ThreadCreate, session: AsyncSession = Depends(get_session)):
    thread = Thread(
        title=payload.title or "New thread",
        model=payload.model,
        system_prompt=payload.system_prompt,
        enabled_skills=default_enabled_skills(),
    )
    session.add(thread)
    await session.commit()
    await session.refresh(thread)
    return (await _decorate(session, [thread]))[0]


@router.get("/{thread_id}", response_model=ThreadOut)
async def get_thread(thread_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    thread = await session.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")
    return (await _decorate(session, [thread]))[0]


@router.patch("/{thread_id}", response_model=ThreadOut)
async def update_thread(thread_id: uuid.UUID, payload: ThreadUpdate, session: AsyncSession = Depends(get_session)):
    thread = await session.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(thread, key, value)
    await session.commit()
    await session.refresh(thread)
    return (await _decorate(session, [thread]))[0]


@router.delete("/{thread_id}")
async def delete_thread(thread_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    thread = await session.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")
    await session.delete(thread)
    await session.commit()
    return {"ok": True}


@router.get("/{thread_id}/messages", response_model=list[MessageOut])
async def list_messages(thread_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    thread = await session.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")
    msgs = list(
        (await session.execute(
            select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc())
        )).scalars().all()
    )
    arts = list(
        (await session.execute(select(Artifact).where(Artifact.thread_id == thread_id))).scalars().all()
    )
    by_msg: dict[uuid.UUID, list] = {}
    for a in arts:
        if a.message_id:
            by_msg.setdefault(a.message_id, []).append(a)

    out = []
    for m in msgs:
        item = MessageOut.model_validate(m)
        item.artifacts = [a for a in by_msg.get(m.id, [])]
        out.append(item)
    return out


@router.delete("/{thread_id}/messages")
async def clear_messages(thread_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    await session.execute(delete(Message).where(Message.thread_id == thread_id))
    await session.execute(delete(Artifact).where(Artifact.thread_id == thread_id))
    thread = await session.get(Thread, thread_id)
    if thread:
        thread.summary = ""
        thread.summary_cursor = None
    await session.commit()
    return {"ok": True}


@router.delete("/{thread_id}/messages/{message_id}")
async def delete_message(thread_id: uuid.UUID, message_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    await session.execute(delete(Artifact).where(Artifact.message_id == message_id))
    await session.execute(delete(Message).where(Message.id == message_id, Message.thread_id == thread_id))
    await session.commit()
    return {"ok": True}
