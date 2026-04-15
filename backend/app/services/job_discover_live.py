"""Job discovery plus optional Adzuna live listings."""

from __future__ import annotations

import logging
import re

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


def _tokenize(text: str | None) -> set[str]:
    if not text:
        return set()
    raw = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", text.lower())
    stop = {
        "with",
        "from",
        "your",
        "this",
        "that",
        "have",
        "will",
        "role",
        "jobs",
        "job",
        "work",
        "team",
        "years",
        "experience",
    }
    return {t for t in raw if t not in stop}


def _score_listing(
    params: JobDiscoverParams,
    listing: ParsedListing,
) -> tuple[float, list[str], list[str]]:
    reasons: list[str] = []
    risks: list[str] = []
    score = 2.4

    listing_blob = " ".join(
        x
        for x in (
            listing.title,
            listing.employer,
            listing.location,
            listing.excerpt,
        )
        if x
    )
    listing_tokens = _tokenize(listing_blob)

    role_tokens = _tokenize(params.role_focus)
    role_overlap = len(role_tokens & listing_tokens)
    if role_overlap >= 2:
        score += 1.3
        reasons.append("Strong overlap with your role focus.")
    elif role_overlap == 1:
        score += 0.7
        reasons.append("Some alignment with your role focus.")

    industry_tokens = _tokenize(" ".join(params.industries))
    industry_overlap = len(industry_tokens & listing_tokens)
    if industry_overlap >= 2:
        score += 0.8
        reasons.append("Industry terms match your target sectors.")
    elif industry_overlap == 1:
        score += 0.4
        reasons.append("Touches one of your target sectors.")

    resume_tokens = _tokenize(params.resume_context)
    resume_overlap = len(resume_tokens & listing_tokens)
    if resume_overlap >= 7:
        score += 0.7
        reasons.append("Several résumé keywords appear in this listing.")
    elif resume_overlap >= 3:
        score += 0.4
        reasons.append("Some résumé keywords appear in this listing.")

    city = (params.city_or_region or "").strip().lower()
    loc = (listing.location or "").strip().lower()
    if city and loc and city in loc:
        score += 0.5
        reasons.append("Location aligns with your preferred region.")

    if params.emphasize_remote_global:
        remote_tokens = {"remote", "worldwide", "global", "distributed", "hybrid"}
        if remote_tokens & listing_tokens:
            score += 0.3
            reasons.append("Matches your remote/global preference.")

    if not (listing.source_url or "").strip():
        risks.append("No source URL attached - verify posting details manually.")
        score -= 0.3
    if not (listing.employer or "").strip() or (listing.employer or "").strip().lower() == "unknown employer":
        risks.append("Employer is missing or generic - validate company identity.")
        score -= 0.2
    if not (listing.excerpt or "").strip():
        risks.append("Limited listing context - open the original posting before applying.")
        score -= 0.2

    if not reasons:
        reasons.append("Potential fit, but needs manual review against your profile.")

    bounded = max(1.0, min(5.0, score))
    rounded = round(bounded, 1)
    return rounded, reasons[:6], risks[:5]


def _annotate_listings_with_fit(
    params: JobDiscoverParams,
    listings: list[ParsedListing],
) -> list[ParsedListing]:
    out: list[ParsedListing] = []
    for pl in listings:
        fit_score, fit_reasons, risk_flags = _score_listing(params, pl)
        out.append(
            pl.model_copy(
                update={
                    "fit_score": fit_score,
                    "fit_reasons": fit_reasons,
                    "risk_flags": risk_flags,
                }
            )
        )
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
    result = result.model_copy(
        update={"parsed_listings": _annotate_listings_with_fit(params, result.parsed_listings)}
    )
    return result
