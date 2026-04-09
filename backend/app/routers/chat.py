from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.graph.chat_workflow import build_chat_graph

router = APIRouter(tags=["chat"])

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

    graph = build_chat_graph(settings)
    result = await graph.ainvoke({"messages": lc_messages})
    last = result["messages"][-1]
    if not isinstance(last, AIMessage):
        raise HTTPException(status_code=500, detail="Unexpected model output type")
    content = last.content
    text = content if isinstance(content, str) else str(content)
    return ChatResponse(reply=text.strip() or "…", model=settings.openrouter_chat_model)
