"""Structured résumé signals: skills + short career context (LLM)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.services.llm import chat_llm

if TYPE_CHECKING:
    from app.config import Settings

_SYSTEM = """You extract structured career signals from résumé text only.
Rules:
- Use only what appears in the résumé; do not invent employers, degrees, or dates.
- Skills: concrete tools, technologies, certifications, methods (nouns/phrases), max 24 items.
- Target roles: job titles or close paraphrases the candidate plausibly wants, max 8 items.
- Summary: 2–4 short sentences about trajectory and strengths.
- If the text is not a résumé, still return best-effort empty/minimal fields."""


class ResumeProfileSignals(BaseModel):
    headline: str | None = Field(
        default=None,
        max_length=240,
        description="One-line professional headline if inferable.",
    )
    skills: list[str] = Field(default_factory=list, max_length=24)
    target_roles: list[str] = Field(default_factory=list, max_length=8)
    seniority: str | None = Field(default=None, max_length=80)
    industries: list[str] = Field(default_factory=list, max_length=12)
    locations_or_remote: str | None = Field(
        default=None,
        max_length=200,
        description="Stated locations, relocation, or remote preference.",
    )
    summary: str = Field(
        default="",
        max_length=1200,
        description="2–4 sentences; grounded in the résumé.",
    )


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
        HumanMessage(
            content="Résumé text:\n\n" + (body if body else "(empty)"),
        ),
    ]
    return await llm.ainvoke(messages)
