from __future__ import annotations

import json
import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import Enum
from typing import Any

import httpx

from .config import get_settings

settings = get_settings()


class Provider(str, Enum):
    OPENROUTER = "openrouter"
    GEMINI = "gemini"
    GROQ = "groq"
    OLLAMA = "ollama"


@dataclass
class ProviderConfig:
    name: Provider
    base_url: str
    api_key_env: str
    api_key_setting: str
    models_endpoint: str
    chat_endpoint: str
    headers_factory: str  # function name in _make_headers


PROVIDERS: dict[Provider, ProviderConfig] = {
    Provider.OPENROUTER: ProviderConfig(
        name=Provider.OPENROUTER,
        base_url=settings.openrouter_base_url,
        api_key_env="OPENROUTER_API_KEY",
        api_key_setting="openrouter_api_key",
        models_endpoint="/models",
        chat_endpoint="/chat/completions",
        headers_factory="_make_openrouter_headers",
    ),
    Provider.GEMINI: ProviderConfig(
        name=Provider.GEMINI,
        base_url="https://generativelanguage.googleapis.com/v1beta",
        api_key_env="GEMINI_API_KEY",
        api_key_setting="gemini_api_key",
        models_endpoint="/models",
        chat_endpoint="/models/{model}:streamGenerateContent?alt=sse",
        headers_factory="_make_gemini_headers",
    ),
    Provider.GROQ: ProviderConfig(
        name=Provider.GROQ,
        base_url="https://api.groq.com/openai/v1",
        api_key_env="GROQ_API_KEY",
        api_key_setting="groq_api_key",
        models_endpoint="/models",
        chat_endpoint="/chat/completions",
        headers_factory="_make_groq_headers",
    ),
    Provider.OLLAMA: ProviderConfig(
        name=Provider.OLLAMA,
        base_url="http://localhost:11434",
        api_key_env="",
        api_key_setting="ollama_base_url",
        models_endpoint="/api/tags",
        chat_endpoint="/api/chat",
        headers_factory="_make_ollama_headers",
    ),
}


_MODELS_CACHE: dict[Provider, dict] = {}


def _make_openrouter_headers(api_key: str | None) -> dict[str, str]:
    key = api_key or settings.openrouter_api_key or ""
    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Seafor",
    }
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _make_gemini_headers(api_key: str | None) -> dict[str, str]:
    key = api_key or settings.gemini_api_key or ""
    headers = {"Content-Type": "application/json"}
    if key:
        headers["x-goog-api-key"] = key
    return headers


def _make_groq_headers(api_key: str | None) -> dict[str, str]:
    key = api_key or settings.groq_api_key or ""
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _make_ollama_headers(api_key: str | None) -> dict[str, str]:
    return {"Content-Type": "application/json"}


def _get_headers_factory(name: str):
    return globals()[name]


async def _fetch_models(provider: Provider, api_key: str | None = None, ollama_base_url: str | None = None) -> list[dict]:
    config = PROVIDERS[provider]
    # Use custom ollama_base_url if provided for Ollama provider
    base_url = config.base_url
    if provider == Provider.OLLAMA and ollama_base_url:
        base_url = ollama_base_url
    cache_key = f"{provider.value}_{api_key or 'default'}"
    now = time.time()
    cached = _MODELS_CACHE.get(cache_key)
    if cached and now - cached["at"] < 600.0 and cached["data"]:
        return cached["data"]

    headers_factory = _get_headers_factory(config.headers_factory)
    headers = headers_factory(api_key)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(f"{base_url}{config.models_endpoint}", headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    models = _normalize_models(provider, data)
    _MODELS_CACHE[cache_key] = {"at": now, "data": models}
    return models


def _normalize_models(provider: Provider, data: Any) -> list[dict]:
    models = []
    prefix = provider.value
    if provider == Provider.OPENROUTER:
        for m in data.get("data", []):
            raw_id = m.get("id", "")
            top = m.get("top_provider") or {}
            pricing = m.get("pricing") or {}
            arch = m.get("architecture") or {}
            models.append({
                "id": f"{prefix}/{raw_id}",
                "name": m.get("name", raw_id),
                "description": (m.get("description") or "")[:280],
                "context_length": m.get("context_length") or top.get("context_length") or 0,
                "max_completion_tokens": top.get("max_completion_tokens") or 0,
                "modality": arch.get("modality", "text->text"),
                "input_modalities": arch.get("input_modalities", []),
                "prompt_price": pricing.get("prompt", ""),
                "completion_price": pricing.get("completion", ""),
                "provider": provider.value,
            })
    elif provider == Provider.GEMINI:
        for m in data.get("models", []):
            name = m.get("name", "").replace("models/", "")
            models.append({
                "id": f"{prefix}/{name}",
                "name": name,
                "description": m.get("description", "")[:280],
                "context_length": m.get("inputTokenLimit", 0) + m.get("outputTokenLimit", 0),
                "max_completion_tokens": m.get("outputTokenLimit", 0),
                "modality": "text->text",
                "input_modalities": ["text"],
                "prompt_price": "0",
                "completion_price": "0",
                "provider": provider.value,
            })
    elif provider == Provider.GROQ:
        for m in data.get("data", []):
            raw_id = m.get("id", "")
            models.append({
                "id": f"{prefix}/{raw_id}",
                "name": m.get("name", raw_id),
                "description": (m.get("description") or "")[:280],
                "context_length": m.get("context_length", 0),
                "max_completion_tokens": m.get("max_completion_tokens", 0),
                "modality": "text->text",
                "input_modalities": ["text"],
                "prompt_price": "0",
                "completion_price": "0",
                "provider": provider.value,
            })
    elif provider == Provider.OLLAMA:
        for m in data.get("models", []):
            name = m.get("name", "")
            models.append({
                "id": f"{prefix}/{name}",
                "name": name,
                "description": f"Ollama model: {name}",
                "context_length": 8192,
                "max_completion_tokens": 4096,
                "modality": "text->text",
                "input_modalities": ["text"],
                "prompt_price": "0",
                "completion_price": "0",
                "provider": provider.value,
            })
    models.sort(key=lambda x: x["name"].lower())
    return models


async def list_models(api_key: str | None = None, gemini_api_key: str | None = None, groq_api_key: str | None = None, provider: Provider | None = None, ollama_base_url: str | None = None) -> list[dict]:
    if provider:
        if provider == Provider.GEMINI:
            return await _fetch_models(provider, gemini_api_key, ollama_base_url)
        elif provider == Provider.GROQ:
            return await _fetch_models(provider, groq_api_key, ollama_base_url)
        else:
            return await _fetch_models(provider, api_key, ollama_base_url)
    all_models = []
    for p in Provider:
        try:
            if p == Provider.GEMINI:
                models = await _fetch_models(p, gemini_api_key, ollama_base_url)
            elif p == Provider.GROQ:
                models = await _fetch_models(p, groq_api_key, ollama_base_url)
            else:
                models = await _fetch_models(p, api_key, ollama_base_url)
            all_models.extend(models)
        except Exception:
            pass
    all_models.sort(key=lambda x: x["name"].lower())
    return all_models


async def get_model_info(model_id: str, api_key: str | None = None, ollama_base_url: str | None = None, gemini_api_key: str | None = None, groq_api_key: str | None = None) -> dict:
    for p in Provider:
        if p == Provider.GEMINI:
            models = await _fetch_models(p, gemini_api_key, ollama_base_url)
        elif p == Provider.GROQ:
            models = await _fetch_models(p, groq_api_key, ollama_base_url)
        else:
            models = await _fetch_models(p, api_key, ollama_base_url)
        for m in models:
            if m["id"] == model_id:
                return m
    return {"id": model_id, "name": model_id, "context_length": 8192, "provider": "openrouter"}


def _detect_provider(model_id: str) -> Provider:
    model_lower = model_id.lower()
    # Authoritative provider prefixes (set by _normalize_models).
    if model_lower.startswith("ollama/"):
        return Provider.OLLAMA
    if model_lower.startswith("gemini/"):
        return Provider.GEMINI
    if model_lower.startswith("groq/"):
        return Provider.GROQ
    if model_lower.startswith("openrouter/"):
        return Provider.OPENROUTER
    # Legacy / bare-id heuristics (no provider prefix present).
    if model_lower.startswith("models/") or model_lower.startswith("gemini-") or "gemini" in model_lower:
        return Provider.GEMINI
    if any(x in model_lower for x in ["llama", "mixtral", "gemma", "qwen"]):
        return Provider.GROQ
    return Provider.OPENROUTER


_THINK_TAGS = [
    (" thinking", "</think>"),
    ("<thinking>", "</thinking>"),
]


class ThinkFilter:
    """Split inline `` thinking`` / ``<thinking>`` blocks out of a token stream.

    Models that expose chain-of-thought as part of their content (rather than a
    dedicated field) leak raw `` thinking`` XML. This routes the tagged spans to
    ``reasoning`` so the UI can render them in its collapsible panel.
    """

    def __init__(self) -> None:
        self.in_think = False
        self.buf = ""

    @staticmethod
    def _find(text: str, tags: list[str]) -> tuple[int, str] | None:
        low = text.lower()
        best: tuple[int, str] | None = None
        for tag in tags:
            idx = low.find(tag)
            if idx != -1 and (best is None or idx < best[0]):
                best = (idx, tag)
        return best

    @staticmethod
    def _hold_len(text: str, tags: list[str]) -> int:
        low = text.lower()
        hold = 0
        for tag in tags:
            for k in range(1, min(len(tag), len(low) + 1)):
                if low.endswith(tag[:k]):
                    hold = max(hold, k)
        return hold

    def feed(self, text: str) -> list[tuple[str, str]]:
        self.buf += text
        out: list[tuple[str, str]] = []
        while True:
            if not self.in_think:
                found = self._find(self.buf, [o for o, _ in _THINK_TAGS])
                if found:
                    idx, tag = found
                    if idx > 0:
                        out.append(("content", self.buf[:idx]))
                    self.buf = self.buf[idx + len(tag):]
                    self.in_think = True
                    continue
                hold = self._hold_len(self.buf, [o for o, _ in _THINK_TAGS])
                if len(self.buf) > hold:
                    cut = len(self.buf) - hold
                    out.append(("content", self.buf[:cut]))
                    self.buf = self.buf[cut:]
                break
            else:
                found = self._find(self.buf, [c for _, c in _THINK_TAGS])
                if found:
                    idx, tag = found
                    if idx > 0:
                        out.append(("reasoning", self.buf[:idx]))
                    self.buf = self.buf[idx + len(tag):]
                    self.in_think = False
                    continue
                hold = self._hold_len(self.buf, [c for _, c in _THINK_TAGS])
                if len(self.buf) > hold:
                    cut = len(self.buf) - hold
                    out.append(("reasoning", self.buf[:cut]))
                    self.buf = self.buf[cut:]
                break
        return out

    def flush(self) -> list[tuple[str, str]]:
        if not self.buf:
            return []
        kind = "reasoning" if self.in_think else "content"
        out = [(kind, self.buf)]
        self.buf = ""
        return out


_THINK_RE = re.compile(
    r"<think(?:ing)?>.*?</think(?:ing)?>", re.IGNORECASE | re.DOTALL
)


def strip_think(text: str) -> str:
    """Remove inline think blocks, keeping only the final answer."""
    out = _THINK_RE.sub("", text)
    out = re.sub(r"</?think(?:ing)?>", "", out, flags=re.IGNORECASE)
    return out.strip()


async def stream_chat(
    *,
    messages: list[dict],
    model: str,
    api_key: str | None,
    gemini_api_key: str | None = None,
    groq_api_key: str | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    ollama_base_url: str | None = None,
) -> AsyncIterator[dict]:
    provider = _detect_provider(model)
    config = PROVIDERS[provider]
    headers_factory = _get_headers_factory(config.headers_factory)
    
    # Use the appropriate API key based on provider
    if provider == Provider.GEMINI:
        headers = _make_gemini_headers(gemini_api_key)
    elif provider == Provider.GROQ:
        headers = _make_groq_headers(groq_api_key)
    else:
        headers = headers_factory(api_key)

    # Use custom ollama_base_url if provided
    base_url = config.base_url
    if provider == Provider.OLLAMA and ollama_base_url:
        base_url = ollama_base_url

    if provider == Provider.GEMINI:
        model_name = model.replace("gemini/", "").replace("models/", "")
        payload = {
            "contents": [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]} for m in messages],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens or 8192},
        }
        endpoint = f"{base_url}/models/{model_name}:streamGenerateContent?alt=sse"
    elif provider == Provider.OLLAMA:
        model_name = model.replace("ollama/", "").replace("ollama:", "")
        payload = {
            "model": model_name,
            "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens or -1},
        }
        endpoint = f"{base_url}{config.chat_endpoint}"
    else:
        payload = {
            "model": model.replace("groq/", "").replace("openrouter/", ""),
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "stream_options": {"include_usage": True},
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        endpoint = f"{config.base_url}{config.chat_endpoint}"

    tf = ThinkFilter()

    def emit(text: str) -> list[dict]:
        return [
            {"type": "delta" if kind == "content" else "reasoning", "text": t}
            for kind, t in tf.feed(text)
        ]

    timeout = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", endpoint, headers=headers, json=payload) as resp:
            if resp.status_code >= 400:
                body = (await resp.aread()).decode("utf-8", "ignore")
                yield {"type": "error", "message": _extract_error(resp.status_code, body)}
                return

            async for line in resp.aiter_lines():
                if not line or not line.strip():
                    continue
                if provider == Provider.OLLAMA:
                    # Ollama streams newline-delimited JSON (no "data:" prefix).
                    raw = line.strip()
                else:
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                try:
                    chunk = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                if provider == Provider.GEMINI:
                    for cand in chunk.get("candidates", []):
                        content = cand.get("content", {})
                        for part in content.get("parts", []):
                            if "text" in part:
                                for ev in emit(part["text"]):
                                    yield ev
                        if chunk.get("usageMetadata"):
                            u = chunk["usageMetadata"]
                            yield {"type": "usage", "prompt_tokens": u.get("promptTokenCount"), "completion_tokens": u.get("candidatesTokenCount")}
                elif provider == Provider.OLLAMA:
                    msg = chunk.get("message") or {}
                    if msg.get("thinking"):
                        yield {"type": "reasoning", "text": msg["thinking"]}
                    if "content" in msg and msg["content"]:
                        for ev in emit(msg["content"]):
                            yield ev
                    if chunk.get("done"):
                        yield {"type": "usage", "prompt_tokens": chunk.get("prompt_eval_count"), "completion_tokens": chunk.get("eval_count")}
                else:
                    if chunk.get("usage"):
                        u = chunk["usage"]
                        yield {"type": "usage", "prompt_tokens": u.get("prompt_tokens"), "completion_tokens": u.get("completion_tokens")}
                    for choice in chunk.get("choices") or []:
                        delta = choice.get("delta") or {}
                        if delta.get("reasoning"):
                            yield {"type": "reasoning", "text": delta["reasoning"]}
                        if delta.get("content"):
                            for ev in emit(delta["content"]):
                                yield ev
                        finish = choice.get("finish_reason")
                        if finish and finish not in ("stop", "null"):
                            yield {"type": "finish", "reason": finish}
                if chunk.get("error"):
                    yield {"type": "error", "message": str(chunk["error"])}

    for ev in (
        {"type": "delta" if kind == "content" else "reasoning", "text": t}
        for kind, t in tf.flush()
    ):
        yield ev


async def complete(
    *,
    messages: list[dict],
    model: str,
    api_key: str | None,
    gemini_api_key: str | None = None,
    groq_api_key: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1024,
    ollama_base_url: str | None = None,
) -> str:
    provider = _detect_provider(model)
    config = PROVIDERS[provider]
    headers_factory = _get_headers_factory(config.headers_factory)

    base_url = config.base_url
    if provider == Provider.OLLAMA and ollama_base_url:
        base_url = ollama_base_url
    
    # Use the appropriate API key based on provider
    if provider == Provider.GEMINI:
        headers = _make_gemini_headers(gemini_api_key)
    elif provider == Provider.GROQ:
        headers = _make_groq_headers(groq_api_key)
    else:
        headers = _make_openrouter_headers(api_key)

    if provider == Provider.GEMINI:
        model_name = model.replace("gemini/", "").replace("models/", "")
        payload = {
            "contents": [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]} for m in messages],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        }
        endpoint = f"{base_url}/models/{model_name}:generateContent"
    elif provider == Provider.OLLAMA:
        model_name = model.replace("ollama/", "").replace("ollama:", "")
        payload = {
            "model": model_name,
            "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
            "stream": False,
            # Disable chain-of-thought for non-streaming calls: thinking models
            # otherwise emit everything into "thinking" (or burn the whole token
            # budget) and leave "content" empty, which breaks JSON extraction in
            # judges/summarizers. Ignored by models that don't support thinking.
            "think": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        endpoint = f"{base_url}{config.chat_endpoint}"
    else:
        payload = {"model": model.replace("groq/", "").replace("openrouter/", ""), "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        endpoint = f"{base_url}{config.chat_endpoint}"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(endpoint, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        text = ""
        if provider == Provider.GEMINI:
            for cand in data.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    if "text" in part:
                        text = part["text"]
                        break
                if text:
                    break
        elif provider == Provider.OLLAMA:
            text = data.get("message", {}).get("content", "")
        else:
            choices = data.get("choices") or []
            if choices:
                text = (choices[0].get("message") or {}).get("content") or ""
        return strip_think(text)


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