from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import artifacts as art
from .. import context as ctx
from .. import memory as mem
from ..database import SessionLocal, get_session
from ..models import Artifact, Message, Thread
from ..openrouter import get_model_info, stream_chat
from ..schemas import ChatRequest
from ..settings_store import get_app_settings
from ..skills import build_system_context

router = APIRouter(prefix="/api/threads", tags=["chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _title_from(text: str) -> str:
    line = " ".join(text.strip().split())
    return (line[:60] + "…") if len(line) > 60 else (line or "New thread")


async def _extract_memories_bg(
    thread_id: uuid.UUID, model: str, api_key: str | None, transcript: str
) -> None:
    try:
        async with SessionLocal() as db:
            await mem.extract(
                db,
                transcript=transcript,
                model=model,
                api_key=api_key,
                source_thread_id=thread_id,
            )
    except Exception:  # noqa: BLE001
        pass


@router.post("/{thread_id}/chat")
async def chat(thread_id: uuid.UUID, payload: ChatRequest, session: AsyncSession = Depends(get_session)):
    thread = await session.get(Thread, thread_id)
    if not thread:
        raise HTTPException(404, "Thread not found")

    app_settings = await get_app_settings(session)
    api_key = app_settings.get("api_key") or None
    if not api_key:
        raise HTTPException(400, "No OpenRouter API key set. Add one in Settings.")

    model = payload.model or thread.model or app_settings.get("default_model") or "openai/gpt-4o-mini"
    temperature = payload.temperature if payload.temperature is not None else app_settings.get("temperature", 0.7)
    max_tokens = payload.max_tokens if payload.max_tokens is not None else app_settings.get("max_tokens", 0)
    base_prompt = (
        payload.system_prompt
        if payload.system_prompt is not None
        else (thread.system_prompt or app_settings.get("system_prompt", ""))
    )

    # ------------------------------------------------------ regenerate mode
    if payload.regenerate_message_id:
        target = await session.get(Message, payload.regenerate_message_id)
        if target and target.thread_id == thread_id:
            await session.execute(delete(Artifact).where(Artifact.message_id == target.id))
            await session.execute(
                delete(Message).where(Message.thread_id == thread_id, Message.created_at >= target.created_at)
            )
            await session.commit()

    # ------------------------------------------------------ persist user turn
    user_msg: Message | None = None
    if not payload.regenerate_message_id:
        user_msg = Message(thread_id=thread_id, role="user", content=payload.content)
        session.add(user_msg)
        thread.model = model
        if thread.title in ("", "New thread"):
            thread.title = _title_from(payload.content)
        await session.commit()
        await session.refresh(user_msg)

    # ------------------------------------------------------ canonical history
    msgs = list(
        (await session.execute(
            select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc())
        )).scalars().all()
    )

    # Retrieve long-term memory relevant to this turn and inject it so even a
    # fresh thread (or a switched model) still "remembers" the user.
    query_text = payload.content or (msgs[-1].content if msgs and msgs[-1].role == "user" else "")
    memories = await mem.retrieve(session, query_text, k=8)
    if memories:
        mem.touch(memories)
        await session.commit()

    enabled_skills = thread.enabled_skills or ["canvas"]
    system_content = build_system_context(
        enabled_skills, base_prompt, [m.content for m in memories]
    )
    system_tokens = ctx.estimate_tokens(system_content) + ctx.estimate_tokens(thread.summary or "")

    model_info = await get_model_info(model, api_key)
    context_length = model_info.get("context_length") or 8192

    history = ctx.history_after_cursor(msgs, thread.summary_cursor)
    if ctx.needs_compaction(
        system_tokens=system_tokens,
        history=history,
        summary=thread.summary or "",
        context_length=context_length,
        fraction=app_settings.get("context_fraction", 0.72),
    ):
        new_summary, cursor = await ctx.compact(
            existing_summary=thread.summary or "",
            history=history,
            model_id=model,
            api_key=api_key,
        )
        if cursor:
            thread.summary = new_summary
            thread.summary_cursor = cursor
            await session.commit()
            history = ctx.history_after_cursor(msgs, cursor)

    built = ctx.build_messages(
        system_content=system_content,
        summary=thread.summary or "",
        history=history,
        model_id=model,
    )

    # ------------------------------------------------------ assistant placeholder
    assistant = Message(
        thread_id=thread_id,
        role="assistant",
        content="",
        model=model,
        meta={
            "streaming": True,
            "skills": list(enabled_skills),
            "memories": len(memories),
        },
    )
    session.add(assistant)
    await session.commit()
    await session.refresh(assistant)
    assistant_id = assistant.id
    user_id = user_msg.id if user_msg else None

    async def generate() -> AsyncIterator[str]:
        yield _sse(
            "meta",
            {
                "thread_id": str(thread_id),
                "message_id": str(assistant_id),
                "user_message_id": str(user_id) if user_id else None,
                "model": model,
                "input_tokens_estimate": built.estimated_input_tokens,
                "folded_system": built.folded_system,
            },
        )

        full = ""
        reasoning = ""
        usage = {"prompt_tokens": None, "completion_tokens": None}
        error: str | None = None

        try:
            async for event in stream_chat(
                messages=built.messages,
                model=model,
                api_key=api_key,
                temperature=temperature,
                max_tokens=max_tokens or None,
            ):
                etype = event.get("type")
                if etype == "delta":
                    full += event["text"]
                    yield _sse("delta", {"text": event["text"]})
                elif etype == "reasoning":
                    reasoning += event["text"]
                    yield _sse("reasoning", {"text": event["text"]})
                elif etype == "usage":
                    usage["prompt_tokens"] = event.get("prompt_tokens")
                    usage["completion_tokens"] = event.get("completion_tokens")
                elif etype == "error":
                    error = event.get("message", "Unknown error")
                    yield _sse("error", {"message": error})
        except Exception as exc:  # noqa: BLE001
            error = str(exc)
            yield _sse("error", {"message": error})

        # ------------------------------------------------- finalize + canvas
        cleaned, blocks = art.parse_canvas_blocks(full)
        saved_tokens = 0
        artifact_payloads = []
        async with SessionLocal() as db:
            msg = await db.get(Message, assistant_id)
            if msg is None:
                yield _sse("done", {})
                return
            for block in blocks:
                artifact = Artifact(
                    thread_id=thread_id,
                    message_id=assistant_id,
                    title=block.title,
                    kind=block.kind,
                    language=block.language,
                    content=block.content,
                    tokens_saved=art.tokens_of(block.content),
                )
                db.add(artifact)
                saved_tokens += artifact.tokens_saved
                await db.flush()
                artifact_payloads.append(
                    {
                        "id": str(artifact.id),
                        "title": artifact.title,
                        "kind": artifact.kind,
                        "language": artifact.language,
                    }
                )

            meta = dict(msg.meta or {})
            meta.pop("streaming", None)
            if reasoning:
                meta["reasoning"] = reasoning
            if error:
                meta["error"] = error
            if artifact_payloads:
                meta["canvas"] = artifact_payloads
            if saved_tokens:
                meta["tokens_saved"] = saved_tokens

            stored_content = cleaned if blocks else full
            msg.content = stored_content
            msg.prompt_tokens = usage["prompt_tokens"]
            msg.completion_tokens = usage["completion_tokens"]
            msg.meta = meta
            db.add(msg)
            await db.commit()

        yield _sse(
            "final",
            {
                "message_id": str(assistant_id),
                "content": cleaned if blocks else full,
                "reasoning": reasoning,
                "artifacts": artifact_payloads,
                "tokens_saved": saved_tokens,
                "usage": usage,
                "error": error,
            },
        )
        yield _sse("done", {})

        # Learn durable facts about the user in the background (never blocks the
        # response). Stored memories feed every future thread.
        if user_msg is not None and not error and full.strip():
            transcript = "\n".join(
                f"{m.role.upper()}: {m.content}" for m in msgs if m.content
            ) + f"\nASSISTANT: {cleaned if blocks else full}"
            asyncio.create_task(
                _extract_memories_bg(thread_id, model, api_key, transcript)
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
