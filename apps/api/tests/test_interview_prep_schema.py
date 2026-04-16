"""Schema stability for expanded Phase 5 interview prep (no LLM)."""

from backend.app.services.application_package import InterviewPrepLLM


def test_interview_prep_llm_full_payload_validates():
    raw = {
        "likely_questions": [f"Question {i}?" for i in range(5)],
        "study_topics": [f"Topic {i}" for i in range(4)],
        "weakness_gaps": ["Light on distributed systems at scale"],
        "star_stories": [
            {
                "headline": "Shipped billing retry",
                "situation": "Customers saw failed charges.",
                "task": "Lead fix without downtime.",
                "action": "Added idempotent webhooks and DLQ.",
                "result": "Retry success +95%; fewer support tickets.",
                "reflection": "Would add metrics earlier next time.",
            },
            {
                "headline": "Mentored juniors",
                "situation": "Team doubled quickly.",
                "task": "Keep quality bar while onboarding.",
                "action": "Pairing rota + code review checklist.",
                "result": "Median review time stable; fewer regressions.",
                "reflection": "Document patterns sooner.",
            },
            {
                "headline": "Cut p95 latency",
                "situation": "Search felt slow.",
                "task": "Find and remove hot paths.",
                "action": "Profiled, cached, batch queries.",
                "result": "p95 −40%.",
                "reflection": "Load test in CI.",
            },
        ],
        "company_brief": {
            "summary": "B2B SaaS for ops teams; sells workflow automation.",
            "tech_stack_signals": ["Python", "PostgreSQL", "Kubernetes"],
            "culture_signals": ["Written RFCs", "Weekly demos"],
            "recent_momentum": [
                "Specific news not verified from inputs — emphasize curiosity in interview.",
            ],
        },
    }
    m = InterviewPrepLLM.model_validate(raw)
    assert len(m.likely_questions) == 5
    assert len(m.star_stories) == 3
    assert m.company_brief.summary.startswith("B2B")
