"""Resume text extraction for PDF / DOCX / TXT uploads.

Never executes uploaded content — only extracts plain text, enforces
extension + size limits from settings.
"""
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings


async def extract_resume_text(upload: UploadFile, dest: Path) -> tuple[str, int, str]:
    """Save upload to dest, return (text, size_bytes, content_type)."""
    # Defence in depth: never write outside the configured uploads directory,
    # even if a caller builds `dest` from unsanitised input.
    upload_root = settings.upload_dir.resolve()
    if not dest.resolve().is_relative_to(upload_root):
        raise HTTPException(status_code=400, detail="Invalid upload path")
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {ext or '(none)'}. "
            f"Allowed: {', '.join(sorted(settings.allowed_extensions))}",
        )
    data = await upload.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(data)//1024} KB). "
            f"Max {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    text = _extract_text(dest, ext)
    return text, len(data), upload.content_type or ""


def _extract_text(path: Path, ext: str) -> str:
    if ext == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")[:20000]
    if ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        parts = [(page.extract_text() or "") for page in reader.pages[:20]]
        return "\n".join(parts)[:20000]
    if ext == ".docx":
        import docx

        doc = docx.Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs)[:20000]
    return ""
