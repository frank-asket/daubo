"""Orchestrator chat with per-user pipeline context (Phase 6)."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.deps.users import get_clerk_user_id
from app.schemas.agents_chat import AgentsChatRequest, ChatHistoryMessage
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.services.llm import chat_llm
from backend.app.services.orchestrator_context import build_pipeline_context_block
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["agents"])
logger = logging.getLogger("daubo")

# Keep product facts aligned with apps/api/app/routers/chat.py
_ORCHESTRATOR_BASE = """You are the career orchestrator inside Daubo’s job-search workspace. Be concise, encouraging, and practical—write for job seekers, not developers.

Product facts:
- Users save roles under “My jobs” with stages: draft → shortlisted → package_ready → ready_to_apply → applied → interview → offer → closed.
- Smart prep can generate application packages (and optionally Gmail drafts) for saved roles that have posting text—never automatic clicks or submits on third-party sites.
- The user applies manually on official employer or LinkedIn flows; Daubo does not auto-apply.
- Gmail: optional; Daubo creates email drafts only—never auto-sends.
- Approvals: sensitive outbound steps require explicit user approval when enabled.

Ground recommendations in the pipeline snapshot below when relevant. If something is outside the snapshot, say you are not sure."""

_MAX_HISTORY_TURNS = 24
_MAX_HISTORY_CHARS = 48_000


def _history_to_lc(msgs: list[ChatHistoryMessage]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in msgs:
        if m.role == "user":
            out.append(HumanMessage(content=m.content))
        else:
            out.append(AIMessage(content=m.content))
    return out


def _trim_history(msgs: list[ChatHistoryMessage]) -> list[ChatHistoryMessage]:
    slice_ = msgs[-_MAX_HISTORY_TURNS:]
    kept: list[ChatHistoryMessage] = []
    total = 0
    for m in reversed(slice_):
        add = len(m.content)
        if total + add > _MAX_HISTORY_CHARS and kept:
            break
        kept.append(m)
        total += add
    return list(reversed(kept))


def _text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                t = block.get("text")
                if isinstance(t, str):
                    parts.append(t)
                elif block.get("type") == "text" and isinstance(block.get("text"), str):
                    parts.append(block["text"])
        return "".join(parts).strip()
    if content is None:
        return ""
    return str(content).strip()


def _chunk_delta(chunk: Any) -> str:
    c = getattr(chunk, "content", None)
    return _text_from_content(c)


async def _sse_token_stream(
    *,
    settings: Settings,
    lc_messages: list[BaseMessage],
) -> AsyncIterator[bytes]:
    llm = chat_llm(settings)
    try:
        async for chunk in llm.astream(lc_messages):
            delta = _chunk_delta(chunk)
            if delta:
                yield f"data: {json.dumps({'type': 'token', 'text': delta})}\n\n".encode()
        done_payload = json.dumps({"type": "done", "model": settings.openrouter_chat_model})
        yield f"data: {done_payload}\n\n".encode()
    except Exception:
        logger.exception("agents_chat stream failed")
        err = json.dumps({"type": "error", "message": "stream_failed"})
        yield f"data: {err}\n\n".encode()


@router.post("/agents/chat")
async def agents_chat(
    body: AgentsChatRequest,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=503,
            detail="The orchestrator is not available on this deployment (missing AI configuration).",
        )

    try:
        context_block = await build_pipeline_context_block(session, user_id)
    except Exception:
        logger.exception("build_pipeline_context_block failed")
        context_block = "(Pipeline snapshot temporarily unavailable.)"

    system_text = f"{_ORCHESTRATOR_BASE}\n\n{context_block}"
    prior = _trim_history(body.history)
    lc_messages: list[BaseMessage] = [SystemMessage(content=system_text)]
    lc_messages.extend(_history_to_lc(prior))
    lc_messages.append(HumanMessage(content=body.message))

    return StreamingResponse(
        _sse_token_stream(settings=settings, lc_messages=lc_messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
