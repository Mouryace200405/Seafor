from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Seafor"

    database_url: str = "postgresql+asyncpg://chati:chati@127.0.0.1:5432/chati"

    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_api_key: str | None = None
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Fraction of a model's context window that may be used for input.
    context_fraction: float = 0.72
    # Always keep this many most-recent messages untouched by compaction.
    keep_recent_messages: int = 8
    # Rough chars-per-token used for budgeting.
    chars_per_token: float = 3.6

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
