from types import SimpleNamespace
import unittest

from app.services.pipeline_integrity import (
    choose_stronger_status,
    duplicate_key_for_application,
    normalize_application_status,
)


class PipelineIntegrityHelpersTest(unittest.TestCase):
    def test_normalize_status_aliases(self) -> None:
        self.assertEqual(normalize_application_status("ready"), "ready_to_apply")
        self.assertEqual(normalize_application_status("interviewing"), "interview")
        self.assertEqual(normalize_application_status(""), "draft")
        self.assertEqual(normalize_application_status("not_real"), "draft")

    def test_choose_stronger_status(self) -> None:
        self.assertEqual(choose_stronger_status("applied", "interview"), "interview")
        self.assertEqual(choose_stronger_status("ready", "draft"), "ready_to_apply")

    def test_duplicate_key_prefers_url(self) -> None:
        row = SimpleNamespace(
            title="Data Engineer",
            company="Daubo",
            job_url="https://example.com/job/123",
            location="Paris",
        )
        key = duplicate_key_for_application(row)  # type: ignore[arg-type]
        self.assertEqual(key, "data engineer|daubo|https://example.com/job/123")

    def test_duplicate_key_falls_back_to_location(self) -> None:
        row = SimpleNamespace(
            title="Data Engineer",
            company="Daubo",
            job_url=None,
            location="Paris",
        )
        key = duplicate_key_for_application(row)  # type: ignore[arg-type]
        self.assertEqual(key, "data engineer|daubo|paris")


if __name__ == "__main__":
    unittest.main()

