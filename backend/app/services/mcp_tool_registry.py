"""
In-process MCP-style tool registry: JSON-schema-like specs + names that map to Daubo services.

A future standalone MCP server can expose the same tool list; agents and HTTP routes call these
implementations server-side only (OAuth tokens never leave the API).
"""

from __future__ import annotations

from typing import Any, TypedDict


class McpToolSpec(TypedDict):
    """Subset of MCP tool metadata (name, description, input schema shape)."""

    name: str
    description: str
    input_schema: dict[str, Any]


# Tool names align with LangGraph tools and REST capabilities documented for agents.
TOOL_SEARCH_JOB_POSTINGS_WEB: McpToolSpec = {
    "name": "search_job_postings_web",
    "description": "Search the public web for current job openings (Tavily).",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Role, skills, location or remote, industry.",
            },
        },
        "required": ["query"],
    },
}

TOOL_GMAIL_CREATE_APPLICATION_DRAFT: McpToolSpec = {
    "name": "gmail_create_application_draft",
    "description": (
        "Create a Gmail draft for a saved job application (user sends from Gmail). "
        "Requires Gmail OAuth and an existing application package."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {
                "type": "string",
                "description": "UUID of the JobApplication row.",
            },
        },
        "required": ["application_id"],
    },
}

TOOL_LINKEDIN_JOB_DEEP_LINK: McpToolSpec = {
    "name": "linkedin_job_deep_link",
    "description": (
        "Return the job URL for user-driven apply on LinkedIn or the employer site — "
        "no automated submission."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "job_url": {"type": "string", "description": "Posting URL if known."},
        },
        "required": [],
    },
}


def list_daubo_mcp_tools() -> list[McpToolSpec]:
    """Tools exposed to planner/sub-agents (specs only; invocation stays in FastAPI)."""
    return [
        TOOL_SEARCH_JOB_POSTINGS_WEB,
        TOOL_GMAIL_CREATE_APPLICATION_DRAFT,
        TOOL_LINKEDIN_JOB_DEEP_LINK,
    ]


def tool_names() -> list[str]:
    return [t["name"] for t in list_daubo_mcp_tools()]


def summarize_registry_for_prompt() -> str:
    """Short list for system prompts (supervisor / future deep agents)."""
    lines = [f"- {t['name']}: {t['description']}" for t in list_daubo_mcp_tools()]
    return "Available integration tools:\n" + "\n".join(lines)
