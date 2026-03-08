from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    llm_provider: str = Field(default="openrouter")
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4o-mini")
    openai_base_url: str | None = Field(default=None)

    # OpenRouter support (token must come from env, never hardcoded).
    openrouter_api_key: str = Field(default="")
    openrouter_model: str = Field(default="openai/gpt-oss-120b:free")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1")

    max_upload_size_mb: int = Field(default=10, ge=1, le=50)
    max_text_chars: int = Field(default=120_000, ge=1_000, le=1_000_000)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
