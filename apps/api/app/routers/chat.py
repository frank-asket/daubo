import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from backend.app.config import Settings, get_settings
from backend.app.services.llm import chat_llm

router = APIRouter(tags=["chat"])
logger = logging.getLogger("daubo")

DAUBO_ASSISTANT_SYSTEM = """You are the career assistant inside Daubo’s job-search workspace. Be concise, encouraging, and practical—write for job seekers, not developers.

Product facts:
- Users save roles under “My jobs” with stages: draft → shortlisted → package_ready → ready_to_apply → applied → interview → offer → closed.
- Smart prep can automatically generate application packages (and optionally Gmail drafts) for saved roles that have posting text—never automatic clicks or submits on LinkedIn, company career sites, or job boards.
- “Apply yourself” means the user opens the real posting and submits on the employer or LinkedIn site themselves. Daubo does not auto-apply anywhere (account safety and third-party terms).
- Gmail: optional connection; Daubo creates email drafts only—never auto-sends.
- The user’s resume powers tailored application materials and interview practice.

If asked about something not in the product, say you are not sure and suggest Settings or support."""

_MAX_HISTORY_TURNS = 24
_MAX_HISTORY_CHARS = 48_000


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=12_000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=16_000)
    history: list[ChatHistoryMessage] = Field(
        default_factory=list,
        max_length=_MAX_HISTORY_TURNS,
        description="Prior turns (user/assistant) for multi-turn Daubo Assistant chat.",
    )


class ChatResponse(BaseModel):
    reply: str
    model: str


def _history_to_lc(msgs: list[ChatHistoryMessage]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in msgs:
        if m.role == "user":
            out.append(HumanMessage(content=m.content))
        else:
            out.append(AIMessage(content=m.content))
    return out


def _trim_history(msgs: list[ChatHistoryMessage]) -> list[ChatHistoryMessage]:
    """Keep the most recent turns under a character budget (newest preserved)."""
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


def _latest_assistant_text(messages: list[BaseMessage]) -> str:
    """Resolve reply text; OpenRouter/LangChain may use AIMessage subclasses or block lists."""
    for m in reversed(messages):
        if isinstance(m, AIMessage):
            t = _text_from_content(m.content)
            if t:
                return t
            continue
        role = getattr(m, "type", None)
        if role == "ai":
            t = _text_from_content(getattr(m, "content", None))
            if t:
                return t
    return ""


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=503,
            detail="The career assistant isn’t available on this deployment yet. Please try again later.",
        )

    prior = _trim_history(body.history)
    lc_messages: list[BaseMessage] = [SystemMessage(content=DAUBO_ASSISTANT_SYSTEM)]
    lc_messages.extend(_history_to_lc(prior))
    lc_messages.append(HumanMessage(content=body.message))

    llm = chat_llm(settings)
    try:
        reply_msg = await llm.ainvoke(lc_messages)
    except Exception as exc:  # noqa: BLE001
        logger.exception("chat llm.ainvoke failed (OpenRouter / LangChain)")
        raise HTTPException(
            status_code=502,
            detail="We couldn’t get a reply right now. Please try again in a moment.",
        ) from exc

    if not isinstance(reply_msg, BaseMessage):
        logger.error("chat llm returned non-message type=%s", type(reply_msg).__name__)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong with that answer. Please try again.",
        )

    text = _latest_assistant_text([reply_msg])
    if not text:
        text = _text_from_content(getattr(reply_msg, "content", None))
    if not text:
        logger.error("Empty assistant content from model; type=%s", type(reply_msg).__name__)
        raise HTTPException(
            status_code=500,
            detail="We couldn’t read the reply. Please try again.",
        )
    return ChatResponse(reply=text or "…", model=settings.openrouter_chat_model)

