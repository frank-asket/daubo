"""Lightweight agent acknowledgement after resume ingest (uses existing chat graph)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langchain_core.messages import AIMessage, HumanMessage

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger("daubo")


async def agent_ack_after_resume_upload(settings: Settings) -> str | None:
    """Runs multi-agent chat graph once to confirm the pipeline will use the new profile."""
    if not settings.openrouter_api_key:
        return None
    try:
        from app.graph.chat_workflow import build_chat_graph

        graph = build_chat_graph(settings)
        prompt = (
            "The user just uploaded or updated their master resume in the Daubo workspace. "
            "Reply in 2 short sentences: confirm that multi-agent matching will use this profile "
            "to find relevant roles worldwide and that application packages will be aligned to "
            "each job's requirements. Do not ask questions. Do not quote resume content."
        )
        result = await graph.ainvoke({"messages": [HumanMessage(content=prompt)]})
        last = result["messages"][-1]
        if not isinstance(last, AIMessage):
            return None
        content = last.content
        text = content if isinstance(content, str) else str(content)
        return text.strip() or None
    except Exception:
        logger.exception("resume kickoff chat failed (resume still saved)")
        return None
