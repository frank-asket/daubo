from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.graph.chat_workflow import build_chat_graph

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=16_000)


class ChatResponse(BaseModel):
    reply: str
    model: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")
    graph = build_chat_graph(settings)
    result = await graph.ainvoke({"messages": [HumanMessage(content=body.message)]})
    last = result["messages"][-1]
    if not isinstance(last, AIMessage):
        raise HTTPException(status_code=500, detail="Unexpected model output type")
    content = last.content
    text = content if isinstance(content, str) else str(content)
    return ChatResponse(reply=text, model=settings.openrouter_chat_model)
