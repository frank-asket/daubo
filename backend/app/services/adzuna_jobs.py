"""Optional live job listings via Adzuna (https://developer.adzuna.com/)."""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.config import Settings
from app.schemas.jobs import JobDiscoverParams, ParsedListing

logger = logging.getLogger("daubo")

_ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"

# Adzuna path segment per https://developer.adzuna.com/docs/regional (extend as needed).
_ISO_TO_ADZUNA: dict[str, str] = {
    "US": "us",
    "GB": "gb",
    "CA": "ca",
    "AU": "au",
    "DE": "de",
    "FR": "fr",
    "IN": "in",
    "NL": "nl",
    "NZ": "nz",
    "PL": "pl",
    "RU": "ru",
    "SG": "sg",
    "ZA": "za",
    "AT": "at",
    "CH": "ch",
    "BE": "be",
    "ES": "es",
    "IT": "it",
    "BR": "br",
    "MX": "mx",
    "IE": "ie",
    "PT": "pt",
    "SE": "se",
    "NO": "no",
    "DK": "dk",
    "FI": "fi",
}

_NAME_SLUG_HINTS: tuple[tuple[str, str], ...] = (
    ("united states", "us"),
    ("usa", "us"),
    ("u.s.", "us"),
    ("united kingdom", "gb"),
    ("great britain", "gb"),
    ("england", "gb"),
    ("scotland", "gb"),
    ("wales", "gb"),
    ("ireland", "ie"),
    ("canada", "ca"),
    ("australia", "au"),
    ("germany", "de"),
    ("france", "fr"),
    ("india", "in"),
    ("netherlands", "nl"),
    ("new zealand", "nz"),
    ("poland", "pl"),
    ("russia", "ru"),
    ("singapore", "sg"),
    ("south africa", "za"),
    ("austria", "at"),
    ("switzerland", "ch"),
    ("belgium", "be"),
    ("spain", "es"),
    ("italy", "it"),
    ("brazil", "br"),
    ("mexico", "mx"),
    ("portugal", "pt"),
    ("sweden", "se"),
    ("norway", "no"),
    ("denmark", "dk"),
    ("finland", "fi"),
)


def adzuna_country_slug(country_code: str | None, country_name: str) -> str | None:
    if country_code:
        c = country_code.strip().upper()
        if c == "UK":
            c = "GB"
        slug = _ISO_TO_ADZUNA.get(c)
        if slug:
            return slug
    low = (country_name or "").strip().lower()
    if low in ("uk", "u.k.", "britain"):
        return "gb"
    for hint, slug in _NAME_SLUG_HINTS:
        if hint in low:
            return slug
    return None


def build_adzuna_search_query(params: JobDiscoverParams) -> str:
    parts: list[str] = []
    if params.role_focus:
        parts.append(params.role_focus.strip())
    for ind in params.industries[:5]:
        t = ind.strip()
        if t and t not in parts:
            parts.append(t)
    q = " ".join(parts).strip()
    if not q:
        q = "jobs"
    return q[:200]


def _strip_html(raw: str, max_len: int = 600) -> str:
    t = re.sub(r"<[^>]+>", " ", raw or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t[:max_len] if t else ""


def _hit_to_listing(hit: dict[str, Any]) -> ParsedListing | None:
    title = (hit.get("title") or "").strip()
    if not title:
        return None
    company = hit.get("company") or {}
    employer = (company.get("display_name") or "").strip() or None
    loc = hit.get("location") or {}
    location = (loc.get("display_name") or "").strip() or None
    excerpt = _strip_html(hit.get("description") or "")
    url = (hit.get("redirect_url") or "").strip() or None
    if url and len(url) > 2000:
        url = url[:2000]
    ct_raw = hit.get("contract_type")
    contract_type = (str(ct_raw).strip() if ct_raw is not None else None) or None
    return ParsedListing(
        title=title[:500],
        employer=employer[:500] if employer else None,
        location=location[:300] if location else None,
        contract_type=contract_type[:120] if contract_type else None,
        excerpt=excerpt or None,
        source_url=url,
    )


def format_listings_as_paste_block(listings: list[ParsedListing]) -> str:
    """Serialize API hits so the discovery LLM can echo strategy + optional structured rows."""
    header = (
        "--- Live job feed (search API) ---\n"
        "These are real postings; each block may include Source URL. "
        "When you emit parsed_listings, set source_url to that exact URL.\n"
    )
    blocks: list[str] = []
    for i, pl in enumerate(listings, start=1):
        lines = [f"Listing {i}:", f"Title: {pl.title}"]
        if pl.employer:
            lines.append(f"Company: {pl.employer}")
        if pl.location:
            lines.append(f"Location: {pl.location}")
        if pl.contract_type:
            lines.append(f"Contract: {pl.contract_type}")
        if pl.source_url:
            lines.append(f"Source URL: {pl.source_url}")
        if pl.excerpt:
            lines.append(f"Description: {pl.excerpt}")
        blocks.append("\n".join(lines))
    return header + "\n\n".join(blocks)


async def fetch_adzuna_listings(
    settings: Settings,
    *,
    country_slug: str,
    what: str,
    where: str | None,
    max_results: int = 15,
) -> list[ParsedListing]:
    """Return normalized listings; empty list on missing keys, HTTP errors, or unknown region."""
    app_id = (settings.adzuna_app_id or "").strip()
    app_key = (settings.adzuna_app_key or "").strip()
    if not app_id or not app_key:
        return []

    n = max(1, min(max_results, 25))
    params: dict[str, str | int] = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": n,
        "what": what or "jobs",
    }
    if where and where.strip():
        params["where"] = where.strip()[:200]

    url = f"{_ADZUNA_BASE}/{country_slug}/search/1"
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.get(url, params=params)
    except httpx.HTTPError:
        logger.warning("Adzuna request failed (network) for country=%s", country_slug)
        return []

    if r.status_code == 404:
        logger.info("Adzuna has no regional endpoint for slug=%s", country_slug)
        return []
    if not r.is_success:
        logger.warning(
            "Adzuna HTTP %s for country=%s body_prefix=%s",
            r.status_code,
            country_slug,
            (r.text or "")[:120],
        )
        return []

    try:
        payload = r.json()
    except ValueError:
        logger.warning("Adzuna returned non-JSON")
        return []

    results = payload.get("results")
    if not isinstance(results, list):
        return []

    out: list[ParsedListing] = []
    for hit in results:
        if not isinstance(hit, dict):
            continue
        pl = _hit_to_listing(hit)
        if pl:
            out.append(pl)
    return out[:n]
