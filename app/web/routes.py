from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.ai.deepagents_service import DeepAgentsTextService
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
text_service = DeepAgentsTextService()


@router.get("/", response_class=HTMLResponse)
async def editor_page(request: Request):
    return templates.TemplateResponse("editor.html", {"request": request})


@router.post("/api/process-text", response_model=ProcessTextResponse)
async def process_text(payload: ProcessTextRequest):
    settings = get_settings()
    if len(payload.text) > settings.max_text_chars:
        raise HTTPException(status_code=413, detail="Текст слишком большой.")

    try:
        result = text_service.edit_text(payload.text, payload.instructions)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ProcessTextResponse(
        edited_text=result.edited_text,
        changes_summary=result.changes_summary,
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


@router.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    settings = get_settings()
    doc_context = payload.document_text.strip()
    if len(doc_context) > settings.max_text_chars:
        doc_context = doc_context[: settings.max_text_chars]

    try:
        answer = text_service.chat(payload.message, doc_context)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ChatResponse(answer=answer)
