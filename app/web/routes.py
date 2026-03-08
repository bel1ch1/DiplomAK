from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.ai.graph import editor_graph
from app.ai.prompts import CHAT_SYSTEM_PROMPT
from app.core.settings import get_settings
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ProcessTextRequest,
    ProcessTextResponse,
    UploadResponse,
)
from app.services.text_io import extract_text_from_upload

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse)
async def editor_page(request: Request):
    return templates.TemplateResponse("editor.html", {"request": request})


@router.post("/api/process-text", response_model=ProcessTextResponse)
async def process_text(payload: ProcessTextRequest):
    settings = get_settings()
    if len(payload.text) > settings.max_text_chars:
        raise HTTPException(status_code=413, detail="Текст слишком большой.")

    result = editor_graph.invoke(
        {
            "text": payload.text,
            "instructions": payload.instructions,
            "edited_text": "",
            "changes_summary": "",
        }
    )

    return ProcessTextResponse(
        edited_text=result["edited_text"],
        changes_summary=result["changes_summary"],
    )


@router.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    settings = get_settings()
    extracted_text = await extract_text_from_upload(
        upload=file,
        max_size_bytes=settings.max_upload_size_mb * 1024 * 1024,
    )
    if not extracted_text:
        raise HTTPException(status_code=400, detail="В файле не найден текст.")
    if len(extracted_text) > settings.max_text_chars:
        raise HTTPException(status_code=413, detail="Текст из файла слишком большой.")

    return UploadResponse(filename=file.filename or "uploaded_file", extracted_text=extracted_text)


def _build_chat_llm() -> ChatOpenAI:
    settings = get_settings()
    provider = settings.llm_provider.lower().strip()
    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured.")
        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=0.2,
        )

    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.")
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=0.2,
    )


@router.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    settings = get_settings()
    doc_context = payload.document_text.strip()
    if len(doc_context) > settings.max_text_chars:
        doc_context = doc_context[: settings.max_text_chars]

    contextual_message = (
        f"Контекст текущего документа:\n{doc_context}\n\nВопрос пользователя:\n{payload.message}"
        if doc_context
        else payload.message
    )

    llm = _build_chat_llm()
    result = llm.invoke(
        [
            SystemMessage(content=CHAT_SYSTEM_PROMPT),
            HumanMessage(content=contextual_message),
        ]
    )
    return ChatResponse(answer=result.content.strip())
