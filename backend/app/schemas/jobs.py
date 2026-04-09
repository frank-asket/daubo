from pydantic import BaseModel, Field


class JobDiscoverParams(BaseModel):
    country: str = Field(..., min_length=2, max_length=120)
    country_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=2,
        description="ISO 3166-1 alpha-2, optional but helps disambiguation",
    )
    city_or_region: str | None = Field(default=None, max_length=200)
    industries: list[str] = Field(
        default_factory=list,
        description="Sectors to emphasize: nursing, construction, teaching, etc.",
    )
    role_focus: str | None = Field(default=None, max_length=500)
    seniority: str | None = Field(default=None, max_length=120)
    languages: list[str] = Field(default_factory=list)
    locale: str = Field(default="en", max_length=32)
    pasted_listings: str | None = Field(
        default=None,
        max_length=120_000,
        description="Raw text of vacancies to normalize into parsed_listings",
    )


class ParsedListing(BaseModel):
    title: str
    employer: str | None = None
    location: str | None = None
    contract_type: str | None = None
    excerpt: str | None = None


class PortalGuide(BaseModel):
    name: str
    kind: str = Field(
        ...,
        description="e.g. government, aggregator, industry, regional",
    )
    how_to_use: str


class JobDiscoverLLMOut(BaseModel):
    executive_summary: str
    portals: list[PortalGuide]
    example_search_queries: list[str]
    filters_to_apply: list[str]
    regulatory_reminders: str
    parsed_listings: list[ParsedListing] = Field(default_factory=list)


class JobDiscoverResponse(BaseModel):
    country: str
    country_code: str | None
    result: JobDiscoverLLMOut
    notice: str = (
        "Guidance is AI-generated from your parameters and any pasted text. "
        "It is not a live crawl of every opening worldwide—connect job feeds later for freshness."
    )
