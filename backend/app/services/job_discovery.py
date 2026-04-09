from langchain_core.messages import HumanMessage, SystemMessage

from app.config import Settings
from app.schemas.jobs import JobDiscoverLLMOut, JobDiscoverParams
from app.services.llm import chat_llm

SYSTEM = """You are Daubo's global labour-market assistant. Job seekers may target ANY industry \
(healthcare, trades, logistics, education, hospitality, public sector, finance, retail, technology, \
creative fields, and everything else—not only tech).

Strict rules:
1) Never invent specific job posting URLs, closing dates, or salaries. Do not claim a company is \
hiring unless that fact appears in the user's pasted listings.
2) If the user supplied pasted listings, populate parsed_listings ONLY with roles supported by \
that text (quote or paraphrase faithfully).
3) portals describes real *categories* of sources candidates use in that country (government \
labour portals, large aggregators, sector-specific boards). Prefer well-known patterns; do not \
make up obscure domains.
4) example_search_queries must be concrete strings useful on major job sites (keywords, filters, \
Boolean-style patterns).
5) regulatory_reminders: briefly remind users to verify work authorization, contract types, \
and local norms—they vary by country.
6) If the user message includes a resume excerpt (candidate profile), tailor executive_summary, \
example_search_queries, filters_to_apply, and portals to that profile. Never invent \
parsed_listings from the resume alone—parsed_listings only from explicit pasted job ads.

Respond using the required structured schema only."""


def _user_message(params: JobDiscoverParams) -> str:
    parts = [
        f"Country: {params.country}",
    ]
    if params.country_code:
        parts.append(f"ISO country code (if accurate): {params.country_code}")
    if params.city_or_region:
        parts.append(f"City or region: {params.city_or_region}")
    if params.industries:
        parts.append("Industries or sectors: " + ", ".join(params.industries))
    if params.role_focus:
        parts.append(f"Role / focus: {params.role_focus}")
    if params.seniority:
        parts.append(f"Seniority: {params.seniority}")
    if params.languages:
        parts.append("Languages: " + ", ".join(params.languages))
    parts.append(f"Preferred output locale / language: {params.locale}")
    if params.pasted_listings:
        parts.append(
            "The following text may contain job ads pasted by the user. "
            "Extract parsed_listings from it when possible; otherwise leave parsed_listings empty.\n\n"
            + params.pasted_listings.strip()
        )
    if params.resume_context:
        parts.append(
            "\n---\nCandidate resume excerpt (tailor search strategy only; these are NOT job ads):\n"
            + params.resume_context.strip()
        )
    return "\n".join(parts)


async def run_job_discovery(settings: Settings, params: JobDiscoverParams) -> JobDiscoverLLMOut:
    llm = chat_llm(settings).with_structured_output(JobDiscoverLLMOut)
    messages = [
        SystemMessage(content=SYSTEM),
        HumanMessage(content=_user_message(params)),
    ]
    return await llm.ainvoke(messages)
