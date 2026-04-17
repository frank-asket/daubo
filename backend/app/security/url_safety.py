"""Validate user-supplied URLs to reduce SSRF / internal network abuse (stored or future fetch)."""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse

_BLOCKED_HOSTS = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "::1",
        "0.0.0.0",
        "metadata.google.internal",
        "metadata.google.internal.",
    }
)


def validate_public_http_url(url: str, *, allow_private_hosts: bool = False) -> str:
    """
    Ensure URL is http(s) with a host that is not loopback, link-local, private, or cloud metadata.

    Used for job posting URLs and any future server-side fetch. Set allow_private_hosts only in
    controlled dev environments.
    """
    raw = (url or "").strip()
    if not raw:
        raise ValueError("URL is empty.")

    parsed = urlparse(raw)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise ValueError("URL must use http or https.")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise ValueError("URL is missing a host.")

    # Zone ID (e.g. fe80::1%eth0)
    host = host.split("%", 1)[0]

    if not allow_private_hosts:
        if host in _BLOCKED_HOSTS or host.endswith(".localhost") or host.endswith(".local"):
            raise ValueError("URL host is not allowed.")

        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            ip = None
        if ip is not None:
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            ):
                raise ValueError("URL must not point to a private or special-use address.")

        # Block obvious SSRF hostnames (non-IP)
        if re.match(r"^169\.254\.169\.254$", host) or host.startswith("169.254."):
            raise ValueError("URL must not target link-local / metadata-style hosts.")

    return raw
