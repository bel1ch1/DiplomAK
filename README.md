# FastAPI Scientific Editor

FastAPI-приложение для автоматизированного орфографического и стилистического редактирования научных текстов через LangChain + deepagents.

## Что реализовано

- Единый сервис на FastAPI (UI и API вместе, без отдельного frontend-сервиса).
- Редактор с двумя окнами: исходный текст и AI-отредактированный текст.
- Загрузка файла (`.txt`, `.md`, `.docx`) и ручной ввод.
- Редактирование и чат через `deepagents` (поверх LangChain).
- Конфигурирование системных промптов через файлы в директории `app/ai_assets/prompts`.
- Конфигурирование skills через `SKILL.md`/`.txt` файлы в директории `app/ai_assets/skills`.
- Локальные бекапы в браузере.

## Структура

- `main.py` — запуск приложения и подключение статики.
- `app/web/routes.py` — web-страница и API.
- `app/ai/deepagents_service.py` — сервис редактирования и чата на deepagents.
- `app/ai/assets.py` — загрузка prompt/skill файлов из директорий.
- `app/ai/llm_factory.py` — единая фабрика LLM-клиента.
- `app/services/text_io.py` — извлечение текста из файлов.
- `app/templates/editor.html` — встроенный UI.
- `app/static/css/editor.css` и `app/static/js/editor.js` — стили и клиентская логика.

## Запуск

1. Установите зависимости:

```bash
pip install -r requirements.txt
```

2. Создайте `.env` на основе `.env.example`.

3. Запустите сервер:

```bash
uvicorn main:app --reload
```

4. Откройте [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Настройка LLM

### OpenAI (по умолчанию)

В `.env` укажите:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
```

### OpenRouter

В `.env` укажите:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Важно: токены API не хардкодятся в коде и не добавляются в репозиторий.

## Настройка промптов и skills

- Системные и пользовательские шаблоны лежат в `app/ai_assets/prompts`.
- Skills лежат в `app/ai_assets/skills` (рекомендуемый формат `SKILL.md`).
- Пути можно переопределить переменными окружения:
  - `PROMPTS_ASSETS_DIR`
  - `SKILLS_ASSETS_DIR`
