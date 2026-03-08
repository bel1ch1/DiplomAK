from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from app.ai.prompts import (
    EDITOR_SYSTEM_PROMPT,
    REWRITE_USER_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    SUMMARY_USER_PROMPT,
)
from app.core.settings import get_settings


class EditorState(TypedDict):
    text: str
    instructions: str
    edited_text: str
    changes_summary: str


def _build_llm() -> ChatOpenAI:
    settings = get_settings()
    provider = settings.llm_provider.lower().strip()

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")
        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=0.1,
        )

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=0.1,
    )


def _rewrite_node(state: EditorState) -> EditorState:
    llm = _build_llm()
    user_prompt = REWRITE_USER_PROMPT.format(
        instructions=state.get("instructions", "").strip() or "Нет дополнительных инструкций.",
        text=state["text"],
    )
    response = llm.invoke(
        [
            SystemMessage(content=EDITOR_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]
    )
    return {**state, "edited_text": response.content.strip()}


def _summary_node(state: EditorState) -> EditorState:
    llm = _build_llm()
    user_prompt = SUMMARY_USER_PROMPT.format(
        original=state["text"],
        edited=state["edited_text"],
    )
    response = llm.invoke(
        [
            SystemMessage(content=SUMMARY_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]
    )
    return {**state, "changes_summary": response.content.strip()}


def build_editor_graph():
    graph = StateGraph(EditorState)
    graph.add_node("rewrite", _rewrite_node)
    graph.add_node("summarize_changes", _summary_node)
    graph.set_entry_point("rewrite")
    graph.add_edge("rewrite", "summarize_changes")
    graph.add_edge("summarize_changes", END)
    return graph.compile()


editor_graph = build_editor_graph()
