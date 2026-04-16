"""Extract plain text from resume uploads (PDF, DOCX, text, images via vision)."""

from backend.app.services.resume_ingest import extract_resume_text

__all__ = ["extract_resume_text"]

