from langchain_openai import ChatOpenAI

from app.core.settings import get_settings


def build_chat_llm(temperature: float = 0.2) -> ChatOpenAI:
    settings = get_settings()
    provider = settings.llm_provider.lower().strip()

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")
        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=temperature,
        )

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=temperature,
    )
