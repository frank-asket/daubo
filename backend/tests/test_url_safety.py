import unittest

from app.security.url_safety import validate_public_http_url


class UrlSafetyTest(unittest.TestCase):
    def test_accepts_public_https(self) -> None:
        self.assertTrue(
            validate_public_http_url("https://example.com/job/1").startswith("https://")
        )

    def test_rejects_private_ip(self) -> None:
        with self.assertRaises(ValueError):
            validate_public_http_url("http://192.168.1.1/x")

    def test_rejects_localhost(self) -> None:
        with self.assertRaises(ValueError):
            validate_public_http_url("http://localhost/admin")

    def test_allow_private_override(self) -> None:
        validate_public_http_url("http://192.168.1.1/x", allow_private_hosts=True)
