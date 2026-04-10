"""LangGraph ReAct agent: plan → Tavily web search → grounded job leads (AG-UI / CopilotKit)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from app.services.llm import chat_llm
from app.services.tavily_search import tavily_search_jobs

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger("daubo")

JOB_SEARCH_SYSTEM = """You are Daubo's job-scout agent (orchestration via ReAct).

Workflow:
1) Read the user's goal and any résumé context in the thread.
2) Infer skills, seniority, and likely role targets from that context.
3) Plan 1–3 focused web searches for real job postings (title + location or remote + sector).
4) Call `search_job_postings_web` with concrete queries. Prefer separate calls for distinct angles.
5) Summarize with bullet points using ONLY titles, snippets, and URLs returned by the tool—never invent links.

If constraints are too vague for useful search, ask one short clarifying question first.

Industries: candidates may be in healthcare, trades, logistics, education, tech, public sector, etc.—do not assume software-only roles.

Tone: concise, practical, encouraging."""


def build_job_search_graph(settings: Settings):
    if not (settings.tavily_api_key or "").strip():
        raise ValueError("TAVILY_API_KEY is required for the job search agent")
    if not (settings.openrouter_api_key or "").strip():
        raise ValueError("OPENROUTER_API_KEY is required for the job search agent")

    llm = chat_llm(settings)

    @tool
    def search_job_postings_web(query: str) -> str:
        """Search the public web for current job openings and hiring pages.
        Args:
            query: Concrete keywords: role, skills, city/region or 'remote', industry."""
        return tavily_search_jobs(settings, query)

    try:
        return create_react_agent(
            model=llm,
            tools=[search_job_postings_web],
            prompt=JOB_SEARCH_SYSTEM,
            checkpointer=MemorySaver(),
        )
    except Exception:
        logger.exception("create_react_agent failed")
        raise
