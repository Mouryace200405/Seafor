from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator

import httpx

from .config import get_settings

settings = get_settings()

_MODELS_CACHE: dict = {"at": 0.0, "data": []}
_MODELS_TTL = 600.0


def _headers(api_key: str | None) -> dict[str, str]:
    key = api_key or settings.openrouter_api_key or ""
    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Seafor",
    }
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers


async def list_models(api_key: str | None = None) -> list[dict]:
    if time.time() - _MODELS_CACHE["at"] < _MODELS_TTL and _MODELS_CACHE["data"]:
        return _MODELS_CACHE["data"]

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{settings.openrouter_base_url}/models", headers=_headers(api_key))
        resp.raise_for_status()
        data = resp.json().get("data", [])

    models = []
    for m in data:
        top = m.get("top_provider") or {}
        pricing = m.get("pricing") or {}
        arch = m.get("architecture") or {}
        models.append(
            {
                "id": m.get("id", ""),
                "name": m.get("name", m.get("id", "")),
                "description": (m.get("description") or "")[:280],
                "context_length": m.get("context_length") or top.get("context_length") or 0,
                "max_completion_tokens": top.get("max_completion_tokens") or 0,
                "modality": arch.get("modality", "text->text"),
                "input_modalities": arch.get("input_modalities", []),
                "prompt_price": pricing.get("prompt", ""),
                "completion_price": pricing.get("completion", ""),
            }
        )
    models.sort(key=lambda x: x["name"].lower())
    _MODELS_CACHE.update(at=time.time(), data=models)
    return models


async def get_model_info(model_id: str, api_key: str | None = None) -> dict:
    for m in await list_models(api_key):
        if m["id"] == model_id:
            return m
    return {"id": model_id, "name": model_id, "context_length": 8192}


async def stream_chat(
    *,
    messages: list[dict],
    model: str,
    api_key: str | None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> AsyncIterator[dict]:
    payload: dict = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": temperature,
        "stream_options": {"include_usage": True},
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    timeout = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_headers(api_key),
            json=payload,
        ) as resp:
            if resp.status_code >= 400:
                body = (await resp.aread()).decode("utf-8", "ignore")
                yield {"type": "error", "message": _extract_error(resp.status_code, body)}
                return

            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue

                if chunk.get("usage"):
                    u = chunk["usage"]
                    yield {
                        "type": "usage",
                        "prompt_tokens": u.get("prompt_tokens"),
                        "completion_tokens": u.get("completion_tokens"),
                    }
                for choice in chunk.get("choices") or []:
                    delta = choice.get("delta") or {}
                    if delta.get("reasoning"):
                        yield {"type": "reasoning", "text": delta["reasoning"]}
                    if delta.get("content"):
                        yield {"type": "delta", "text": delta["content"]}
                    finish = choice.get("finish_reason")
                    if finish and finish not in ("stop", "null"):
                        yield {"type": "finish", "reason": finish}
                if chunk.get("error"):
                    yield {"type": "error", "message": str(chunk["error"])}


async def complete(
    *,
    messages: list[dict],
    model: str,
    api_key: str | None,
    temperature: float = 0.3,
    max_tokens: int = 1024,
) -> str:
    payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_headers(api_key),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        return (choices[0].get("message") or {}).get("content") or ""


def _extract_error(status: int, body: str) -> str:
    try:
        parsed = json.loads(body)
        err = parsed.get("error")
        if isinstance(err, dict):
            return f"{status}: {err.get('message', body)}"
        if err:
            return f"{status}: {err}"
    except json.JSONDecodeError:
        pass
    return f"{status}: {body[:400]}"
