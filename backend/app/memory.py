from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Memory
from .openrouter import complete

_WORD = re.compile(r"[a-z0-9][a-z0-9'\-]+")
_STOP = {
    "the", "and", "for", "you", "your", "that", "with", "have", "this", "from",
    "are", "was", "were", "his", "her", "him", "she", "they", "them", "their",
    "what", "when", "where", "which", "who", "why", "how", "not", "but", "can",
    "will", "would", "should", "could", "about", "into", "over", "than", "then",
    "some", "any", "all", "also", "just", "like", "want", "need", "get", "got",
    "make", "made", "use", "used", "using", "one", "two", "our", "out", "off",
    "its", "it's", "i'm", "i've", "don't", "doesn't", "isn't", "user",
}


def _tokens(text: str) -> set[str]:
    return {w for w in _WORD.findall((text or "").lower()) if w not in _STOP and len(w) > 2}


def _similar(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _score(memory: Memory, query_tokens: set[str], now: datetime) -> float:
    tokens = _tokens(memory.content)
    overlap = len(tokens & query_tokens)
    score = overlap / (len(query_tokens) ** 0.5 + 1) if query_tokens else 0.0
    if memory.pinned:
        score += 0.6
    score += min(memory.use_count, 5) * 0.02
    age_days = (now - memory.created_at).total_seconds() / 86400 if memory.created_at else 999
    score += max(0.0, 0.15 - age_days * 0.002)
    return score


async def retrieve(session: AsyncSession, query: str, k: int = 8) -> list[Memory]:
    """Return the most relevant long-term memories for a query string."""
    rows = list((await session.execute(select(Memory))).scalars().all())
    if not rows:
        return []
    now = datetime.now(timezone.utc)
    query_tokens = _tokens(query)
    ranked = sorted(rows, key=lambda m: _score(m, query_tokens, now), reverse=True)
    picked = [m for m in ranked if _score(m, query_tokens, now) > 0][:k]
    if not picked:
        picked = [m for m in rows if m.pinned][:k]
    return picked


def touch(memories: list[Memory]) -> None:
    now = datetime.now(timezone.utc)
    for m in memories:
        m.use_count = (m.use_count or 0) + 1
        m.last_used_at = now


async def add(
    session: AsyncSession,
    *,
    content: str,
    kind: str = "fact",
    source_thread_id: uuid.UUID | None = None,
    pinned: bool = False,
    dedupe: bool = True,
) -> Memory | None:
    content = " ".join((content or "").split()).strip()
    if len(content) < 2:
        return None
    if len(content) > 500:
        content = content[:500].rsplit(" ", 1)[0]

    if dedupe:
        existing = list((await session.execute(select(Memory))).scalars().all())
        new_tokens = _tokens(content)
        for m in existing:
            if _similar(new_tokens, _tokens(m.content)) > 0.72:
                return None

    memory = Memory(content=content, kind=kind or "fact", source_thread_id=source_thread_id, pinned=pinned)
    session.add(memory)
    await session.flush()
    return memory


_EXTRACT_SYSTEM = (
    "You extract durable, long-term memories about the user from a conversation. "
    "Keep only stable facts that would help in FUTURE, separate conversations: "
    "their name, role, preferences, ongoing projects, important context, decisions, "
    "goals or constraints. Do NOT store small talk, one-off questions, the assistant's "
    "own output, or anything already obvious/trivial. Each memory is a short standalone "
    "sentence in third person about the user (e.g. \"The user's name is Ivan.\", "
    "\"The user prefers concise answers.\"). Output ONLY a JSON array like "
    "[\"fact one\", \"fact two\"]. If nothing is worth remembering, output []."
)


async def extract(
    session: AsyncSession,
    *,
    transcript: str,
    model: str,
    api_key: str | None,
    source_thread_id: uuid.UUID | None = None,
) -> list[Memory]:
    """Ask the model what is worth remembering, then store de-duplicated facts."""
    if not transcript.strip():
        return []
    try:
        raw = await complete(
            messages=[
                {"role": "system", "content": _EXTRACT_SYSTEM},
                {"role": "user", "content": transcript[-6000:]},
            ],
            model=model,
            api_key=api_key,
            temperature=0.1,
            max_tokens=400,
        )
    except Exception:  # noqa: BLE001
        return []

    items = _parse_items(raw)
    stored: list[Memory] = []
    for item in items[:6]:
        content = item.get("content") if isinstance(item, dict) else str(item)
        kind = item.get("kind", "fact") if isinstance(item, dict) else "fact"
        memory = await add(
            session,
            content=content,
            kind=kind,
            source_thread_id=source_thread_id,
        )
        if memory:
            stored.append(memory)
    if stored:
        await session.commit()
    return stored


def _parse_items(raw: str) -> list:
    raw = (raw or "").strip()
    if not raw:
        return []
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        data = data.get("memories") or data.get("items") or []
    return data if isinstance(data, list) else []
