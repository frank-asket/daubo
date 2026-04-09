import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.services.llm import chat_llm

router = APIRouter(tags=["chat"])
logger = logging.getLogger("daubo")

DAUBO_ASSISTANT_SYSTEM = """You are Daubo Assistant inside the Daubo career workspace. Be concise and practical.

Product facts:
- Users track roles in a pipeline with stages: draft → shortlisted → package_ready → ready_to_apply → applied → interview → offer → closed.
- "Human apply" means the user opens the real job posting (LinkedIn, careers site, etc.), pastes Daubo-generated drafts, and submits themselves. Daubo does not auto-apply or control LinkedIn.
- Gmail: users can connect Google with gmail.compose scope; Daubo creates email drafts only—never auto-sends.
- Resume upload powers tailored application packages and interview prep.

If asked about something not in the product, say you are not sure and suggest checking Settings or the team."""

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
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")

    prior = _trim_history(body.history)
    lc_messages: list[BaseMessage] = [SystemMessage(content=DAUBO_ASSISTANT_SYSTEM)]
    lc_messages.extend(_history_to_lc(prior))
    lc_messages.append(HumanMessage(content=body.message))

    llm = chat_llm(settings)
    try:
        reply_msg = await llm.ainvoke(lc_messages)
    except Exception as exc:  # noqa: BLE001
        logger.exception("chat llm.ainvoke failed (OpenRouter / LangChain)")
        msg = str(exc).strip() or repr(exc)
        if len(msg) > 500:
            msg = msg[:500] + "…"
        raise HTTPException(
            status_code=502,
            detail=f"Assistant could not reach the model. Check OPENROUTER_API_KEY and model id. ({msg})",
        ) from exc

    if not isinstance(reply_msg, BaseMessage):
        logger.error("chat llm returned non-message type=%s", type(reply_msg).__name__)
        raise HTTPException(
            status_code=500,
            detail="Unexpected model output. Try another OPENROUTER_CHAT_MODEL.",
        )

    text = _latest_assistant_text([reply_msg])
    if not text:
        text = _text_from_content(getattr(reply_msg, "content", None))
    if not text:
        logger.error("Empty assistant content from model; type=%s", type(reply_msg).__name__)
        raise HTTPException(
            status_code=500,
            detail="The model returned no assistant text. Try another OPENROUTER_CHAT_MODEL or retry.",
        )
    return ChatResponse(reply=text or "…", model=settings.openrouter_chat_model)
