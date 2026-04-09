"""Job discovery plus optional Adzuna live listings."""

from __future__ import annotations

import logging

from app.config import Settings
from app.schemas.jobs import JobDiscoverLLMOut, JobDiscoverParams, ParsedListing
from app.services.adzuna_jobs import (
    adzuna_country_slug,
    build_adzuna_search_query,
    fetch_adzuna_listings,
    format_listings_as_paste_block,
    resolve_adzuna_country_slug,
)
from app.services.job_discovery import run_job_discovery

logger = logging.getLogger("daubo")


def _listing_key(pl: ParsedListing) -> tuple[str, str]:
    return (
        pl.title.strip().lower(),
        (pl.employer or "").strip().lower(),
    )


def _merge_parsed_listings(
    preferred: list[ParsedListing],
    extra: list[ParsedListing],
    *,
    max_rows: int = 25,
) -> list[ParsedListing]:
    seen: set[tuple[str, str]] = set()
    out: list[ParsedListing] = []
    for pl in preferred + extra:
        if not pl.title.strip():
            continue
        k = _listing_key(pl)
        if k in seen:
            continue
        seen.add(k)
        out.append(pl)
        if len(out) >= max_rows:
            break
    return out


def _dedupe_listings(chunks: list[ParsedListing], *, max_rows: int) -> list[ParsedListing]:
    seen: set[tuple[str, str]] = set()
    out: list[ParsedListing] = []
    for pl in chunks:
        if not pl.title.strip():
            continue
        k = _listing_key(pl)
        if k in seen:
            continue
        seen.add(k)
        out.append(pl)
        if len(out) >= max_rows:
            break
    return out


async def _collect_adzuna_listings(
    settings: Settings,
    params: JobDiscoverParams,
) -> list[ParsedListing]:
    """Primary region (near user) + extra Adzuna regions from resume-derived ISO codes."""
    if not (settings.adzuna_app_id and settings.adzuna_app_key):
        return []
    default_slug = (settings.adzuna_default_country or "").strip() or None
    primary_slug = resolve_adzuna_country_slug(
        params.country_code,
        params.country,
        default_slug=default_slug,
    )
    if not primary_slug:
        return []

    what = build_adzuna_search_query(params)
    if params.emphasize_remote_global and "remote" not in what.lower():
        what = (what + " remote").strip()[:200]

    chunks: list[ParsedListing] = []
    primary_rows = await fetch_adzuna_listings(
        settings,
        country_slug=primary_slug,
        what=what,
        where=params.city_or_region,
        max_results=12,
    )
    chunks.extend(primary_rows)

    seen_slugs: set[str] = {primary_slug}
    primary_iso = (params.country_code or "").strip().upper()
    if primary_iso == "UK":
        primary_iso = "GB"

    for code in params.additional_country_codes[:6]:
        if len(code) != 2 or code == primary_iso:
            continue
        slug = adzuna_country_slug(code, "")
        if not slug or slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        what_other = build_adzuna_search_query(params)
        extra = await fetch_adzuna_listings(
            settings,
            country_slug=slug,
            what=what_other,
            where=None,
            max_results=8,
        )
        chunks.extend(extra)

    return _dedupe_listings(chunks, max_rows=28)


async def run_job_discovery_with_optional_adzuna(
    settings: Settings,
    params: JobDiscoverParams,
) -> JobDiscoverLLMOut:
    api_listings = await _collect_adzuna_listings(settings, params)

    paste_block = format_listings_as_paste_block(api_listings) if api_listings else None
    pieces = [p for p in (params.pasted_listings, paste_block) if p]
    merged_paste = "\n\n".join(pieces) if pieces else None
    effective = params.model_copy(update={"pasted_listings": merged_paste})
    result = await run_job_discovery(settings, effective)
    if api_listings:
        merged = _merge_parsed_listings(api_listings, result.parsed_listings)
        result = result.model_copy(update={"parsed_listings": merged})
    return result
