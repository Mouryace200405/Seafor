from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- settings
class SettingsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    has_api_key: bool
    api_key_hint: str = ""
    gemini_api_key_hint: str = ""
    groq_api_key_hint: str = ""
    default_model: str = ""
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 0
    tts_voice: str = ""
    tts_rate: float = 1.0
    auto_tts: bool = False
    context_fraction: float = 0.72
    openrouter_configured_via_env: bool = False
    gemini_configured_via_env: bool = False
    groq_configured_via_env: bool = False


class SettingsUpdate(BaseModel):
    default_model: str | None = None
    system_prompt: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    tts_voice: str | None = None
    tts_rate: float | None = None
    auto_tts: bool | None = None
    context_fraction: float | None = None


# ---------------------------------------------------------------- threads
class ThreadCreate(BaseModel):
    title: str = "New thread"
    model: str = ""
    system_prompt: str = ""


class ThreadUpdate(BaseModel):
    title: str | None = None
    model: str | None = None
    system_prompt: str | None = None
    enabled_skills: list[str] | None = None
    pinned: bool | None = None
    archived: bool | None = None


class ThreadOut(ORMModel):
    id: uuid.UUID
    title: str
    model: str
    system_prompt: str
    enabled_skills: list[str]
    pinned: bool
    archived: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    preview: str = ""


# ---------------------------------------------------------------- messages
class MessageOut(ORMModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    role: str
    content: str
    model: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    meta: dict
    created_at: datetime
    artifacts: list["ArtifactOut"] = []


# ---------------------------------------------------------------- artifacts
class ArtifactCreate(BaseModel):
    title: str = "Untitled"
    kind: str = "markdown"
    language: str = ""
    content: str = ""
    message_id: uuid.UUID | None = None


class ArtifactUpdate(BaseModel):
    title: str | None = None
    kind: str | None = None
    language: str | None = None
    content: str | None = None


class ArtifactOut(ORMModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    message_id: uuid.UUID | None
    title: str
    kind: str
    language: str
    content: str
    tokens_saved: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- memories
class MemoryCreate(BaseModel):
    content: str
    kind: str = "fact"
    pinned: bool = False


class MemoryUpdate(BaseModel):
    content: str | None = None
    kind: str | None = None
    pinned: bool | None = None


class MemoryOut(ORMModel):
    id: uuid.UUID
    content: str
    kind: str
    source_thread_id: uuid.UUID | None
    pinned: bool
    use_count: int
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- prompts
class PromptCreate(BaseModel):
    title: str
    content: str = ""


class PromptUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class PromptOut(ORMModel):
    id: uuid.UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- chat
class ChatRequest(BaseModel):
    content: str
    model: str | None = None
    system_prompt: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    regenerate_message_id: uuid.UUID | None = None


# ---------------------------------------------------------------- skills
class SkillOut(BaseModel):
    name: str
    description: str
    builtin: bool = False


MessageOut.model_rebuild()
