from pydantic import ValidationError

from app.schemas.jobs import ParsedListing


def test_parsed_listing_fit_score_bounds() -> None:
    ParsedListing(title="ML Engineer", fit_score=4.5)
    try:
        ParsedListing(title="ML Engineer", fit_score=5.5)
    except ValidationError:
        pass
    else:
        raise AssertionError("fit_score > 5.0 should fail schema validation")


def test_parsed_listing_defaults_for_reasons_and_risks() -> None:
    row = ParsedListing(title="Data Engineer")
    assert row.fit_reasons == []
    assert row.risk_flags == []
