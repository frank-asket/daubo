"""Supervisor graph: routes to Tavily scout (ReAct) or a brief reply — AG-UI / CopilotKit."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Annotated, Literal

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from app.graph.job_search_agent import JOB_SEARCH_SYSTEM, build_scout_react_graph
from app.services.llm import chat_llm

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger("daubo")

_ROUTER_SYSTEM = """You route Daubo job-search sidebar conversations.
- Choose **scout** when the user wants to find job postings, research employers or roles, compare markets,
  or needs live web search (Tavily) for hiring pages, salaries, or openings.
- Choose **brief** for short replies that do not need web search: thanks, acknowledgements, clarifying
  questions about their résumé already in the thread, or chit-chat.

Default to **scout** if unsure and the message relates to jobs or career search."""


class _RoutePick(BaseModel):
    next_route: Literal["scout", "brief"] = Field(
        description="scout = web job search path; brief = direct reply without tools",
    )


class JobSearchSupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    next_route: str | None


def _route_from_supervisor(state: JobSearchSupervisorState) -> Literal["scout", "brief"]:
    r = (state.get("next_route") or "").strip().lower()
    if r == "brief":
        return "brief"
    return "scout"


def build_job_search_supervisor_graph(settings: "Settings"):
    if not (settings.tavily_api_key or "").strip():
        raise ValueError("TAVILY_API_KEY is required for the job search agent")
    if not (settings.openrouter_api_key or "").strip():
        raise ValueError("OPENROUTER_API_KEY is required for the job search agent")

    scout_graph = build_scout_react_graph(settings, with_checkpointer=False)
    llm = chat_llm(settings)
    router_llm = llm.with_structured_output(_RoutePick)

    async def supervisor_node(state: JobSearchSupervisorState) -> dict:
        msgs = state["messages"]
        router_messages: list[BaseMessage] = [
            SystemMessage(content=_ROUTER_SYSTEM),
            *msgs,
        ]
        try:
            pick = await router_llm.ainvoke(router_messages)
            nxt = pick.next_route if pick else "scout"
        except Exception:
            logger.exception("supervisor route failed; defaulting to scout")
            nxt = "scout"
        return {"next_route": nxt}

    async def scout_node(state: JobSearchSupervisorState, config: object) -> dict:
        prev = state["messages"]
        out = await scout_graph.ainvoke({"messages": prev}, config)
        full = out.get("messages") or []
        if not isinstance(full, list):
            return {"messages": [], "next_route": None}
        delta = full[len(prev) :]
        return {"messages": delta, "next_route": None}

    _BRIEF_SYSTEM = (
        "You are Daubo's job-search copilot. Reply concisely without claiming you searched the web. "
        "If they need fresh job listings, say they can ask for a web search. "
        f"Résumé-grounded job search workflow context: {JOB_SEARCH_SYSTEM[:400]}…"
    )

    async def brief_node(state: JobSearchSupervisorState) -> dict:
        msgs = state["messages"]
        brief_messages: list[BaseMessage] = [SystemMessage(content=_BRIEF_SYSTEM), *msgs]
        try:
            resp = await llm.ainvoke(brief_messages)
        except Exception:
            logger.exception("brief_node failed")
            resp = AIMessage(
                content="Something went wrong — try again, or ask me to search the web for jobs."
            )
        if not isinstance(resp, BaseMessage):
            resp = AIMessage(content=str(resp))
        return {"messages": [resp], "next_route": None}

    graph = StateGraph(JobSearchSupervisorState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("scout", scout_node)
    graph.add_node("brief", brief_node)
    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges(
        "supervisor",
        _route_from_supervisor,
        {"scout": "scout", "brief": "brief"},
    )
    graph.add_edge("scout", END)
    graph.add_edge("brief", END)

    try:
        return graph.compile(checkpointer=MemorySaver())
    except Exception:
        logger.exception("supervisor graph compile failed")
        raise
