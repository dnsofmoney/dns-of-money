"""
DNS of Money SDK Client

Usage:
    from pay_sdk import PayClient

    client = PayClient(
        base_url="https://api.dnsofmoney.com",
        api_key="fas_live_..."
    )

    # Resolve an alias
    result = client.resolve("pay:vendor.alpha")

    # Register an alias
    alias = client.register(
        alias_name="pay:your.name",
        preferred_rail="fednow",
        routing_number="021000021",
        account_number="9876543210",
    )
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class ResolutionResult:
    alias_name: str
    display_name: str
    preferred_rail: str
    is_active: bool
    resolved: bool
    raw: dict[str, Any]


@dataclass
class RegistrationResult:
    alias_name: str
    alias_id: str
    raw: dict[str, Any]


class PayClientError(Exception):
    """Raised when the DNS of Money API returns an error."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


class PayClient:
    """Synchronous client for the DNS of Money API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.dnsofmoney.com",
        timeout: float = 10.0,
    ):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={"X-API-Key": api_key},
            timeout=timeout,
        )

    def resolve(self, alias: str) -> ResolutionResult:
        """Resolve a pay: alias to its payment endpoint."""
        resp = self._client.get(f"/api/v1/resolve/{alias}")
        self._check(resp)
        data = resp.json()
        return ResolutionResult(
            alias_name=data.get("alias_name", ""),
            display_name=data.get("display_name", ""),
            preferred_rail=data.get("preferred_rail", ""),
            is_active=data.get("is_active", False),
            resolved=data.get("resolved", False),
            raw=data,
        )

    def register(
        self,
        alias_name: str,
        preferred_rail: str = "fednow",
        routing_number: str | None = None,
        account_number: str | None = None,
        account_type: str = "checking",
        display_name: str | None = None,
    ) -> RegistrationResult:
        """Register a new pay: alias."""
        body: dict[str, Any] = {
            "alias_name": alias_name,
            "preferred_rail": preferred_rail,
            "account_type": account_type,
        }
        if routing_number:
            body["routing_number"] = routing_number
        if account_number:
            body["account_number"] = account_number
        if display_name:
            body["display_name"] = display_name

        resp = self._client.post("/api/v1/aliases", json=body)
        self._check(resp)
        data = resp.json()
        return RegistrationResult(
            alias_name=data.get("alias_name", alias_name),
            alias_id=data.get("id", ""),
            raw=data,
        )

    def check_availability(self, alias: str) -> str:
        """Check if an alias is available. Returns 'available', 'taken', or 'reserved'."""
        resp = self._client.get(f"/api/v1/aliases/check/{alias}")
        self._check(resp)
        return resp.json().get("status", "unknown")

    def health(self) -> dict[str, Any]:
        """Check API health (no auth required)."""
        resp = httpx.get(f"{self.base_url}/health", timeout=5.0)
        self._check(resp)
        return resp.json()

    def close(self):
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    @staticmethod
    def _check(resp: httpx.Response):
        if resp.status_code >= 400:
            detail = resp.json().get("detail", resp.text) if resp.headers.get("content-type", "").startswith("application/json") else resp.text
            raise PayClientError(resp.status_code, detail)
