from dataclasses import dataclass
from pathlib import Path

from app.core.settings import get_settings

ALLOWED_TEXT_EXTENSIONS = {".md", ".txt"}


DEFAULT_PROMPTS = {
    "deepagent_system": (
        "Ты deep-agent ассистент. Следуй системным инструкциям, не выдумывай факты, "
        "предпочитай лаконичные и точные ответы."
    ),
    "editor_system": (
        "Ты AI-редактор научных текстов на русском языке.\n"
        "1) Исправь орфографию, пунктуацию и явные грамматические ошибки.\n"
        "2) Улучши стиль в сторону научного: точность, ясность, логичность, нейтральный тон.\n"
        "3) Сохрани исходный смысл, факты, термины и структуру аргументации.\n"
        "4) Не добавляй вымышленные факты, ссылки, численные данные или цитаты.\n"
        "5) Минимально вмешивайся, если текст уже качественный."
    ),
    "rewrite_user": (
        "Отредактируй следующий текст для научной публикации.\n\n"
        "Дополнительные инструкции от пользователя:\n"
        "{instructions}\n\n"
        "Текст:\n"
        "{text}"
    ),
    "summary_system": (
        "Сводка изменений должна быть компактной (2-4 пункта) и покрывать: "
        "орфографию, пунктуацию, стиль, синтаксис, терминологию, формулировки."
    ),
    "chat_system": (
        "Ты AI-консультант по академическому письму. Отвечай коротко и практично. "
        "Если передан контекст документа, опирайся на него."
    ),
}


@dataclass(slots=True)
class PromptBundle:
    deepagent_system: str
    editor_system: str
    rewrite_user: str
    summary_system: str
    chat_system: str


def _read_text_file(path: Path) -> str:
    for encoding in ("utf-8", "cp1251"):
        try:
            return path.read_text(encoding=encoding).strip()
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def _load_prompt_file(prompts_dir: Path, stem: str) -> str:
    for ext in (".md", ".txt"):
        candidate = prompts_dir / f"{stem}{ext}"
        if candidate.exists():
            content = _read_text_file(candidate)
            if content:
                return content
    return DEFAULT_PROMPTS[stem]


def load_prompt_bundle() -> PromptBundle:
    settings = get_settings()
    prompts_dir = Path(settings.prompts_assets_dir)
    return PromptBundle(
        deepagent_system=_load_prompt_file(prompts_dir, "deepagent_system"),
        editor_system=_load_prompt_file(prompts_dir, "editor_system"),
        rewrite_user=_load_prompt_file(prompts_dir, "rewrite_user"),
        summary_system=_load_prompt_file(prompts_dir, "summary_system"),
        chat_system=_load_prompt_file(prompts_dir, "chat_system"),
    )


def load_skills_as_virtual_files() -> dict[str, dict[str, str]]:
    settings = get_settings()
    skills_dir = Path(settings.skills_assets_dir)
    if not skills_dir.exists():
        return {}

    files: dict[str, dict[str, str]] = {}
    for path in sorted(skills_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in ALLOWED_TEXT_EXTENSIONS:
            continue
        relative = path.relative_to(skills_dir).as_posix()
        virtual_path = f"/skills/{relative}"
        files[virtual_path] = {"content": _read_text_file(path)}
    return files
