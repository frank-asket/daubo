"""LLM-backed application package and interview prep for human-in-the-loop applying."""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from app.config import Settings
from app.services.llm import chat_llm

logger = logging.getLogger("daubo")

_MAX_RESUME = 14_000
_MAX_JD = 24_000


class ApplicationPackageLLM(BaseModel):
    """Structured drafts the user copies into email or LinkedIn (no auto-send)."""

    cover_letter: str = Field(
        ...,
        description="Email-style body to paste when applying (plain text, no markdown).",
    )
    linkedin_note: str = Field(
        ...,
        description="Short note for LinkedIn Easy Apply or connection request (plain text).",
    )
    checklist: list[str] = Field(
        ...,
        min_length=4,
        max_length=12,
        description="Steps the human completes on the official site (upload PDF, confirm, etc.).",
    )
    tailored_bullets: list[str] = Field(
        default_factory=list,
        max_length=8,
        description="2–6 resume bullet phrases aligned to this job, for the user to merge.",
    )
    channel_hint: str = Field(
        ...,
        description="One of: linkedin, email, web — plus one short reason.",
    )


class InterviewPrepLLM(BaseModel):
    likely_questions: list[str] = Field(
        ...,
        min_length=8,
        max_length=14,
        description="Behavioral and role-specific interview questions.",
    )
    study_topics: list[str] = Field(
        ...,
        min_length=4,
        max_length=10,
        description="Topics or skills to review before the interview.",
    )
    weakness_gaps: list[str] = Field(
        default_factory=list,
        max_length=6,
        description="Potential gaps vs the job; user should prepare stories or honest framing.",
    )


def _trim(s: str | None, max_len: int) -> str:
    if not s:
        return ""
    t = s.strip()
    return t[:max_len] if len(t) > max_len else t


async def generate_application_package(
    settings: Settings,
    *,
    resume_text: str,
    title: str,
    company: str,
    location: str | None,
    job_description: str | None,
    apply_channel: str | None,
) -> dict[str, Any]:
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    resume = _trim(resume_text, _MAX_RESUME)
    jd = _trim(job_description, _MAX_JD)
    loc = (location or "").strip()
    channel = (apply_channel or "infer").strip()

    prompt = f"""You help a job seeker apply through official channels only. The user will copy your text into
their own email client or LinkedIn — you do NOT send anything. Keep a professional, concise Global English tone.

Role: {title}
Company: {company}
Location: {loc or "not specified"}
Preferred apply channel hint from product: {channel}

Job description (may be partial):
{jd or "Not provided — infer from role title and company only."}

Candidate resume (excerpt):
{resume}

Return structured fields:
- cover_letter: ready-to-paste email body (greeting, 2–3 short paragraphs, sign-off). No placeholders like [Your Name] unless unavoidable.
- linkedin_note: under 1800 characters; direct and human.
- checklist: concrete steps for the human (e.g. open posting URL, attach PDF, double-check visa line).
- tailored_bullets: achievement bullets with metrics where possible from resume.
- channel_hint: start with one word: linkedin, email, or web — then colon and rationale.
"""
    llm = chat_llm(settings).with_structured_output(ApplicationPackageLLM)
    try:
        out = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception:
        logger.exception("application package LLM failed")
        raise
    if out is None:
        raise RuntimeError("Model returned no structured package")
    data = out.model_dump()
    data["disclaimer"] = (
        "Draft only. Review and edit before pasting into the official employer site or your email."
    )
    return data


async def generate_interview_prep(
    settings: Settings,
    *,
    resume_text: str,
    title: str,
    company: str,
    job_description: str | None,
    package_summary: str | None = None,
) -> dict[str, Any]:
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    resume = _trim(resume_text, _MAX_RESUME)
    jd = _trim(job_description, _MAX_JD)
    extra = _trim(package_summary, 4000)

    prompt = f"""Prepare the candidate for an upcoming interview. Use Global English. Ground questions in the role and description.

Role: {title}
Company: {company}

Job description:
{jd or "Not provided."}

Resume excerpt:
{resume}

Optional context from application drafts:
{extra or "None."}

Return:
- likely_questions: varied behavioral and technical/role questions they may face.
- study_topics: concrete topics to review.
- weakness_gaps: where resume may be thinner vs the job (for honest prep, not fabrication).
"""
    llm = chat_llm(settings).with_structured_output(InterviewPrepLLM)
    try:
        out = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception:
        logger.exception("interview prep LLM failed")
        raise
    if out is None:
        raise RuntimeError("Model returned no interview prep")
    data = out.model_dump()
    data["disclaimer"] = "For practice only; adapt answers to your real experience."
    return data


def package_summary_text(package_draft: dict[str, Any] | None) -> str | None:
    if not package_draft:
        return None
    parts: list[str] = []
    for key in ("cover_letter", "linkedin_note", "tailored_bullets"):
        val = package_draft.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val.strip()[:2000])
        elif isinstance(val, list):
            parts.append("\n".join(str(x) for x in val[:8]))
    return "\n\n".join(parts) if parts else None
