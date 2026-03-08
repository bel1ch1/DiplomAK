import json
import re
from json import JSONDecodeError

from pydantic import BaseModel

from app.ai.assets import load_prompt_bundle, load_skills_as_virtual_files
from app.ai.llm_factory import build_chat_llm

try:
    from deepagents import create_deep_agent
except ImportError as exc:  # pragma: no cover
    raise RuntimeError("Package 'deepagents' is required. Install dependencies from requirements.txt.") from exc

try:
    from deepagents.backends.utils import create_file_data
except ImportError:  # pragma: no cover
    create_file_data = None


class EditOutput(BaseModel):
    edited_text: str
    changes_summary: str


def _extract_json_block(text: str) -> str:
    fenced = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        return text[first : last + 1].strip()
    return text.strip()


def _parse_edit_output_from_text(text: str) -> EditOutput:
    json_candidate = _extract_json_block(text)
    try:
        data = json.loads(json_candidate)
        if isinstance(data, dict):
            return EditOutput.model_validate(data)
    except (JSONDecodeError, ValueError):
        pass

    # Conservative fallback: keep content as edited text and provide a safe summary.
    fallback_text = text.strip()
    if not fallback_text:
        raise ValueError("Deep agent returned empty content for text editing.")
    return EditOutput(
        edited_text=fallback_text,
        changes_summary="Сводка изменений недоступна: модель вернула ответ в неструктурированном формате.",
    )


def _normalize_files_payload(raw_files: dict[str, dict[str, str]]) -> dict[str, object]:
    if not raw_files:
        return {}

    if create_file_data is None:
        return raw_files

    normalized: dict[str, object] = {}
    for path, payload in raw_files.items():
        normalized[path] = create_file_data(payload.get("content", ""))
    return normalized


def _extract_assistant_text(result: dict) -> str:
    messages = result.get("messages", [])
    for message in reversed(messages):
        if getattr(message, "type", "") != "ai":
            continue
        content = getattr(message, "content", "")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for chunk in content:
                if isinstance(chunk, dict) and chunk.get("type") == "text":
                    parts.append(chunk.get("text", ""))
            return "\n".join(parts).strip()
    return ""


class DeepAgentsTextService:
    def __init__(self) -> None:
        self._skills_virtual_path = ["/skills/"]

    def edit_text(self, text: str, instructions: str) -> EditOutput:
        prompts = load_prompt_bundle()
        skills_files = _normalize_files_payload(load_skills_as_virtual_files())
        rewrite_prompt = prompts.rewrite_user.format(
            instructions=instructions.strip() or "Нет дополнительных инструкций.",
            text=text,
        )

        base_system_prompt = (
            f"{prompts.deepagent_system}\n\n"
            f"{prompts.editor_system}\n\n"
            f"Требования к полю changes_summary: {prompts.summary_system}"
        )

        payload: dict[str, object] = {"messages": [{"role": "user", "content": rewrite_prompt}]}
        if skills_files:
            payload["files"] = skills_files

        # Primary path: native structured output (fast when model supports it reliably).
        try:
            agent = create_deep_agent(
                model=build_chat_llm(temperature=0.1),
                system_prompt=base_system_prompt,
                response_format=EditOutput,
                skills=self._skills_virtual_path,
            )
            result = agent.invoke(payload)
            structured = result.get("structured_response")
            if isinstance(structured, EditOutput):
                return structured
            if isinstance(structured, dict):
                return EditOutput.model_validate(structured)
            raise ValueError("Deep agent did not return structured_response for text editing.")
        except Exception:
            pass

        # Fallback path: ask model to return strict JSON in plain text and parse manually.
        fallback_system_prompt = (
            f"{base_system_prompt}\n\n"
            "Верни ответ СТРОГО в JSON-объекте без пояснений и markdown:\n"
            '{"edited_text":"...","changes_summary":"..."}'
        )
        fallback_agent = create_deep_agent(
            model=build_chat_llm(temperature=0.1),
            system_prompt=fallback_system_prompt,
            skills=self._skills_virtual_path,
        )
        fallback_result = fallback_agent.invoke(payload)
        raw_text = _extract_assistant_text(fallback_result)
        return _parse_edit_output_from_text(raw_text)

    def chat(self, message: str, document_text: str) -> str:
        prompts = load_prompt_bundle()
        skills_files = _normalize_files_payload(load_skills_as_virtual_files())

        contextual_message = (
            f"Контекст текущего документа:\n{document_text}\n\nВопрос пользователя:\n{message}"
            if document_text.strip()
            else message
        )

        system_prompt = f"{prompts.deepagent_system}\n\n{prompts.chat_system}"
        agent = create_deep_agent(
            model=build_chat_llm(temperature=0.2),
            system_prompt=system_prompt,
            skills=self._skills_virtual_path,
        )

        payload = {"messages": [{"role": "user", "content": contextual_message}]}
        if skills_files:
            payload["files"] = skills_files

        result = agent.invoke(payload)
        answer = _extract_assistant_text(result)
        if not answer:
            raise ValueError("Deep agent returned an empty chat response.")
        return answer
