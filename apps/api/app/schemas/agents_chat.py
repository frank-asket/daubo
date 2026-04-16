from typing import Literal

from pydantic import BaseModel, Field


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=12_000)


class AgentsChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=16_000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=24)


class AgentsChatResponse(BaseModel):
    reply: str
    model: str
