from pydantic import BaseModel, Field, field_validator, model_validator


class JobDiscoverParams(BaseModel):
    country: str = Field(..., min_length=2, max_length=120)
    country_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=2,
        description="ISO 3166-1 alpha-2, optional but helps disambiguation",
    )
    city_or_region: str | None = Field(default=None, max_length=200)
    additional_country_codes: list[str] = Field(
        default_factory=list,
        max_length=6,
        description=(
            "Extra ISO2 markets to include (live feed + search ideas)—e.g. second citizenship, "
            "past work countries, or stated relocation targets. Primary country is not repeated here."
        ),
    )
    emphasize_remote_global: bool = Field(
        default=False,
        description=(
            "When true, discovery should cover remote-first and international boards alongside local/near-user."
        ),
    )
    industries: list[str] = Field(
        default_factory=list,
        description="Sectors to emphasize: nursing, infrastructure, teaching, etc.",
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
    resume_context: str | None = Field(
        default=None,
        max_length=16_000,
        description="Resume excerpt for tailoring search strategy (not treated as job adverts).",
    )

    @field_validator("additional_country_codes", mode="before")
    @classmethod
    def _normalize_additional_country_codes(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        out: list[str] = []
        for item in v:
            c = str(item).strip().upper()
            if c == "UK":
                c = "GB"
            if len(c) == 2 and c.isalpha() and c not in out:
                out.append(c)
        return out[:6]

    @model_validator(mode="after")
    def _dedupe_additional_vs_primary(self) -> "JobDiscoverParams":
        primary = (self.country_code or "").strip().upper()
        if primary == "UK":
            primary = "GB"
        if primary:
            self.additional_country_codes = [c for c in self.additional_country_codes if c != primary]
        return self


class ParsedListing(BaseModel):
    title: str
    employer: str | None = None
    location: str | None = None
    contract_type: str | None = None
    excerpt: str | None = None
    fit_score: float | None = Field(
        default=None,
        ge=1.0,
        le=5.0,
        description="Daubo-calculated role fit score (1.0 low, 5.0 high).",
    )
    fit_reasons: list[str] = Field(
        default_factory=list,
        max_length=6,
        description="Short bullets explaining why this role may fit the candidate profile.",
    )
    risk_flags: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="Short caveats to review before saving/applying.",
    )
    source_url: str | None = Field(
        default=None,
        max_length=2000,
        description="Original posting URL when supplied (e.g. live feed or pasted ad).",
    )


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


class ResumeSearchInference(BaseModel):
    """LLM output: geography and focus inferred from resume text only."""

    country: str = Field(..., min_length=2, max_length=120)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    city_or_region: str | None = Field(default=None, max_length=200)
    additional_country_codes: list[str] = Field(
        default_factory=list,
        max_length=6,
        description=(
            "Other ISO2 countries with clear CV ties (work, education, authorization, or explicit job-search intent). "
            "Never duplicate primary country_code."
        ),
    )
    open_to_remote_or_global: bool = Field(
        default=False,
        description=(
            "True if the CV signals remote, distributed teams, digital nomad, or multi-country search intent."
        ),
    )
    industries: list[str] = Field(default_factory=list)
    role_focus: str | None = Field(default=None, max_length=500)
    languages: list[str] = Field(default_factory=list)

    @field_validator("additional_country_codes", mode="before")
    @classmethod
    def _normalize_inference_codes(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        out: list[str] = []
        for item in v:
            c = str(item).strip().upper()
            if c == "UK":
                c = "GB"
            if len(c) == 2 and c.isalpha() and c not in out:
                out.append(c)
        return out[:6]


class JobDiscoverResponse(BaseModel):
    country: str
    country_code: str | None
    result: JobDiscoverLLMOut
    notice: str = (
        "Guidance is AI-generated from your parameters and any pasted text. "
        "When Adzuna API keys are configured, live listings from that region are merged into suggestions."
    )


class DiscoverHintsOut(BaseModel):
    """Prefill for job discover UI — inferred from saved résumé."""

    country: str
    country_code: str | None
    city_or_region: str | None
    industries: list[str]
    role_focus: str | None
    languages: list[str]
    additional_country_codes: list[str]
    emphasize_remote_global: bool
    resume_excerpt: str = Field(..., max_length=16_000)
