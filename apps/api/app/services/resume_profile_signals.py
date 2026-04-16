"""Structured resume signals: skills + short career context (LLM)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from backend.app.services.llm import chat_llm

if TYPE_CHECKING:
    from backend.app.config import Settings

_SYSTEM = """You extract structured career signals from resume text only.
Rules:
- Use only what appears in the resume; do not invent employers, degrees, or dates.
- Skills: concrete tools, technologies, certifications, methods (nouns/phrases), max 24 items.
- Target roles: job titles or close paraphrases the candidate plausibly wants, max 8 items.
- Summary: 2–4 short sentences about trajectory and strengths.
- If the text is not a resume, still return best-effort empty/minimal fields."""


class ResumeProfileSignals(BaseModel):
    headline: str | None = Field(default=None, max_length=240)
    skills: list[str] = Field(default_factory=list, max_length=24)
    target_roles: list[str] = Field(default_factory=list, max_length=8)
    seniority: str | None = Field(default=None, max_length=80)
    industries: list[str] = Field(default_factory=list, max_length=12)
    locations_or_remote: str | None = Field(default=None, max_length=200)
    summary: str = Field(default="", max_length=1200)


async def extract_resume_profile_signals(
    settings: "Settings",
    resume_text: str,
) -> ResumeProfileSignals:
    body = (resume_text or "").strip()
    if len(body) > 14_000:
        body = body[:14_000]
    llm = chat_llm(settings).with_structured_output(ResumeProfileSignals)
    messages = [
        SystemMessage(content=_SYSTEM),
        HumanMessage(content="Resume text:\n\n" + (body if body else "(empty)")),
    ]
    return await llm.ainvoke(messages)

