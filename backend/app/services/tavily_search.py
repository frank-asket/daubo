"""Tavily web search for job discovery (tool backend)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger("daubo")


def tavily_search_jobs(
    settings: "Settings",
    query: str,
    *,
    max_results: int = 6,
    search_depth: str = "advanced",
) -> str:
    """Run Tavily and return a compact text block for the LLM."""
    key = (settings.tavily_api_key or "").strip()
    if not key:
        return "Web search is not configured (missing TAVILY_API_KEY)."

    q = (query or "").strip()
    if not q:
        return "Empty search query."

    try:
        from tavily import TavilyClient
    except ImportError as exc:  # pragma: no cover
        logger.exception("tavily import failed")
        return f"Tavily client unavailable: {exc}"

    try:
        client = TavilyClient(api_key=key)
        resp: dict[str, Any] = client.search(
            query=q,
            max_results=max_results,
            search_depth=search_depth,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("tavily search failed")
        msg = str(exc).strip() or repr(exc)
        return f"Web search failed: {msg[:500]}"

    lines: list[str] = []
    for r in resp.get("results") or []:
        title = (r.get("title") or "").strip()
        url = (r.get("url") or "").strip()
        content = (r.get("content") or "").strip().replace("\n", " ")[:500]
        if title or url:
            lines.append(f"- {title}\n  {url}\n  {content}")

    if not lines:
        return "No web results returned; try broader keywords or another query."

    return "\n".join(lines)
