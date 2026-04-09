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


async def run_job_discovery_with_optional_adzuna(
    settings: Settings,
    params: JobDiscoverParams,
) -> JobDiscoverLLMOut:
    api_listings: list[ParsedListing] = []
    if settings.adzuna_app_id and settings.adzuna_app_key:
        slug = adzuna_country_slug(params.country_code, params.country)
        if slug:
            api_listings = await fetch_adzuna_listings(
                settings,
                country_slug=slug,
                what=build_adzuna_search_query(params),
                where=params.city_or_region,
                max_results=15,
            )
        else:
            logger.info(
                "Skipping Adzuna: unsupported region name=%r code=%r",
                (params.country or "")[:80],
                params.country_code,
            )

    paste_block = format_listings_as_paste_block(api_listings) if api_listings else None
    pieces = [p for p in (params.pasted_listings, paste_block) if p]
    merged_paste = "\n\n".join(pieces) if pieces else None
    effective = params.model_copy(update={"pasted_listings": merged_paste})
    result = await run_job_discovery(settings, effective)
    if api_listings:
        merged = _merge_parsed_listings(api_listings, result.parsed_listings)
        result = result.model_copy(update={"parsed_listings": merged})
    return result
