from pathlib import Path

from fastapi import HTTPException, UploadFile

ALLOWED_EXTENSIONS = {".txt", ".md", ".docx"}


def _parse_docx_bytes(content: bytes) -> str:
    try:
        import docx  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=400,
            detail="Формат .docx требует пакет python-docx.",
        ) from exc

    from io import BytesIO

    document = docx.Document(BytesIO(content))
    text = "\n".join(p.text for p in document.paragraphs)
    return text.strip()


async def extract_text_from_upload(upload: UploadFile, max_size_bytes: int) -> str:
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Поддерживаются только файлы: .txt, .md, .docx",
        )

    content = await upload.read()
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail="Файл слишком большой.",
        )

    if ext in {".txt", ".md"}:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("cp1251", errors="ignore")
        return text.strip()

    if ext == ".docx":
        return _parse_docx_bytes(content)

    raise HTTPException(status_code=400, detail="Неподдерживаемый формат файла.")
