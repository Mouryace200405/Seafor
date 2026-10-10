from __future__ import annotations

from dataclasses import dataclass

from .config import get_settings
from .openrouter import complete

settings = get_settings()

# Reasoning models that reject the "system" role -> fold system into first user turn.
_NO_SYSTEM_HINTS = ("o1", "o3", "o4-mini", "o4-mini", "gpt-5")


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, int(len(text) / settings.chars_per_token))


def supports_system(model_id: str) -> bool:
    mid = (model_id or "").lower()
    return not any(h in mid for h in _NO_SYSTEM_HINTS)


@dataclass
class BuiltContext:
    messages: list[dict]
    estimated_input_tokens: int
    folded_system: bool


def build_messages(
    *,
    system_content: str,
    summary: str,
    history: list[dict],
    model_id: str,
    base_system: str = "",
) -> BuiltContext:
    """Assemble the final request messages.

    `history` is the canonical (model-agnostic) thread history as
    ``{"role", "content"}`` dicts, already ordered oldest -> newest and already
    filtered to the part not covered by `summary`. Because we rebuild the
    request from canonical history on every turn, switching models mid-thread
    keeps full context.
    """
    msgs: list[dict] = []
    sys_parts = []
    if system_content.strip():
        sys_parts.append(system_content.strip())
    if summary.strip():
        sys_parts.append(
            "Summary of the earlier part of this conversation that has been "
            "compacted to save context:\n" + summary.strip()
        )
    system_text = "\n\n".join(sys_parts).strip()

    folded = False
    if system_text and supports_system(model_id):
        msgs.append({"role": "system", "content": system_text})
    elif system_text:
        folded = True

    body = [{"role": m["role"], "content": m["content"]} for m in history if m.get("content", "").strip()]

    if folded and system_text:
        if body and body[0]["role"] == "user":
            body[0] = {
                "role": "user",
                "content": f"{system_text}\n\n{body[0]['content']}",
            }
        else:
            body.insert(0, {"role": "user", "content": system_text})

    if not msgs and (base_system or "").strip():
        # no enabled skills but a base persona exists -> still send it
        pass
    msgs.extend(body)

    estimated = sum(estimate_tokens(m["content"]) for m in msgs)
    return BuiltContext(messages=msgs, estimated_input_tokens=estimated, folded_system=folded)


def needs_compaction(
    *,
    system_tokens: int,
    history: list[dict],
    summary: str,
    context_length: int,
    fraction: float | None = None,
) -> bool:
    fraction = fraction or settings.context_fraction
    budget = int((context_length or 8192) * fraction)
    used = system_tokens + estimate_tokens(summary)
    used += sum(estimate_tokens(m.get("content", "")) for m in history)
    return used > budget


async def compact(
    *,
    existing_summary: str,
    history: list[dict],
    model_id: str,
    api_key: str | None,
    keep_recent: int | None = None,
) -> tuple[str, str | None]:
    """Summarize the oldest part of history, leaving the most recent messages
    intact. Returns (new_summary, cursor_message_id)."""
    keep_recent = keep_recent if keep_recent is not None else settings.keep_recent_messages
    if len(history) <= keep_recent:
        return existing_summary, None

    split = len(history) - keep_recent
    older = history[:split]
    cursor = older[-1]["id"]

    transcript_lines = []
    if existing_summary:
        transcript_lines.append(f"[previous summary]\n{existing_summary}\n")
    for m in older:
        transcript_lines.append(f"{m['role'].upper()}: {m['content']}")
    transcript = "\n".join(transcript_lines)[:24000]

    prompt = (
        "Compress the following conversation into a dense summary that preserves "
        "all facts, decisions, names, numbers, code snippets, constraints and open "
        "questions needed to continue the conversation seamlessly. Be concise but "
        "lossless. Output only the summary.\n\n" + transcript
    )
    try:
        summary = await complete(
            messages=[{"role": "user", "content": prompt}],
            model=model_id,
            api_key=api_key,
            temperature=0.2,
            max_tokens=800,
        )
        summary = summary.strip() or existing_summary
    except Exception:
        return existing_summary, None
    return summary, cursor


def history_after_cursor(messages: list, cursor: str | None) -> list[dict]:
    """Map ORM Message rows to canonical dicts, dropping anything already
    folded into the rolling summary (up to and including `cursor`)."""
    items = [{"id": str(m.id), "role": m.role, "content": m.content} for m in messages]
    if not cursor:
        return items
    for idx, item in enumerate(items):
        if item["id"] == cursor:
            return items[idx + 1 :]
    return items
