"""
DNS of Money SDK — Python client.

Resolve, register, and check availability of pay: aliases.
Uses only the Python standard library (urllib) — no external dependencies.

Usage:
    from dnsofmoney import DNSOfMoneyClient

    client = DNSOfMoneyClient(api_key="fas_live_...")
    result = client.resolve("pay:vendor.alpha")

Or use module-level convenience functions:
    from dnsofmoney import resolve, register, check_availability

    result = resolve("pay:vendor.alpha")
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Optional

from .exceptions import (
    AliasNotFoundError,
    AliasTakenError,
    AuthenticationError,
    CapReachedError,
    DNSOfMoneyError,
    RateLimitError,
)
from .models import (
    Compliance,
    Endpoint,
    Entity,
    RegistrationResponse,
    ResolutionResponse,
)


DEFAULT_BASE_URL = "https://api.dnsofmoney.com"


class DNSOfMoneyClient:
    """
    Synchronous client for the DNS of Money API.

    Uses only stdlib urllib — no external HTTP dependencies required.

    Args:
        api_key: API key for authenticated requests (required for write operations).
        base_url: API base URL. Defaults to https://api.dnsofmoney.com.
        timeout: Request timeout in seconds.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 10.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def resolve(self, alias_uri: str) -> ResolutionResponse:
        """
        Resolve a pay: alias to payment credentials.

        No API key required for public aliases. Authenticated callers
        receive higher-tier responses with additional fields.

        Args:
            alias_uri: A FAS-1 pay: URI (e.g., "pay:vendor.alpha").

        Returns:
            ResolutionResponse with entity info, endpoints, compliance,
            and ISO 20022 hints.

        Raises:
            AliasNotFoundError: If the alias does not exist.
        """
        data = self._get(f"/v1/resolve/{alias_uri}")
        return _parse_resolution(data)

    def register(
        self,
        alias_name: str,
        display_name: str,
        preferred_rail: str,
        **kwargs: Any,
    ) -> RegistrationResponse:
        """
        Register a new pay: alias.

        Requires API key. The alias must not already be taken or reserved.

        Args:
            alias_name: The pay: alias to register (e.g., "pay:your.name").
            display_name: Human-readable display name for the entity.
            preferred_rail: Default payment rail (e.g., "fednow", "xrpl").
            **kwargs: Additional registration fields (routing_number,
                      account_number, account_type, xrpl_address, etc.).

        Returns:
            RegistrationResponse with alias name, registration number,
            and anchor status.

        Raises:
            AliasTakenError: If the alias is already registered.
            CapReachedError: If the founding tier cap has been reached.
            AuthenticationError: If the API key is missing or invalid.
        """
        body = {
            "alias_name": alias_name,
            "display_name": display_name,
            "preferred_rail": preferred_rail,
            **kwargs,
        }
        data = self._post("/v1/aliases", body)
        return RegistrationResponse(
            alias_name=data.get("alias_name", alias_name),
            registration_number=data.get("registration_number"),
            anchor_status=data.get("anchor_status"),
            proof=data.get("proof"),
            created_at=data.get("created_at"),
        )

    def check_availability(self, alias_name: str) -> bool:
        """
        Check if a pay: alias is available to register.

        No API key required.

        Args:
            alias_name: The pay: alias to check (e.g., "pay:your.name").

        Returns:
            True if the alias is available, False if taken or reserved.
        """
        data = self._get(f"/v1/aliases/check/{alias_name}")
        return data.get("status") == "available"

    # ── Internal HTTP helpers ─────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        return self._send(req)

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8")
        headers = {**self._headers(), "Content-Type": "application/json"}
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        return self._send(req)

    def _send(self, req: urllib.request.Request) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = {}
            try:
                body = json.loads(e.read().decode("utf-8"))
            except Exception:
                pass
            self._raise_for_status(e.code, body)
            raise DNSOfMoneyError(f"HTTP {e.code}: {e.reason}", status_code=e.code)

    @staticmethod
    def _raise_for_status(status: int, body: dict[str, Any]) -> None:
        error_code = body.get("error_code", "")
        detail = body.get("detail", "")

        if status == 401:
            raise AuthenticationError()
        if status == 404:
            raise AliasNotFoundError(detail or "unknown alias")
        if status == 409:
            if error_code == "CAP_EXCEEDED":
                raise CapReachedError()
            raise AliasTakenError(detail or "alias taken")
        if status == 429:
            retry = body.get("retry_after")
            raise RateLimitError(retry_after=retry)


# ── Module-level convenience functions ────────────────────────────────────


def resolve(
    alias_uri: str,
    api_key: Optional[str] = None,
    base_url: str = DEFAULT_BASE_URL,
) -> ResolutionResponse:
    """Resolve a pay: alias. See DNSOfMoneyClient.resolve for full docs."""
    return DNSOfMoneyClient(api_key=api_key, base_url=base_url).resolve(alias_uri)


def register(
    alias_name: str,
    display_name: str,
    preferred_rail: str,
    api_key: str,
    base_url: str = DEFAULT_BASE_URL,
    **kwargs: Any,
) -> RegistrationResponse:
    """Register a pay: alias. See DNSOfMoneyClient.register for full docs."""
    return DNSOfMoneyClient(api_key=api_key, base_url=base_url).register(
        alias_name, display_name, preferred_rail, **kwargs
    )


def check_availability(
    alias_name: str,
    base_url: str = DEFAULT_BASE_URL,
) -> bool:
    """Check alias availability. See DNSOfMoneyClient.check_availability for full docs."""
    return DNSOfMoneyClient(base_url=base_url).check_availability(alias_name)


# ── Response parsing ──────────────────────────────────────────────────────


def _parse_resolution(data: dict[str, Any]) -> ResolutionResponse:
    """Parse a raw JSON dict into a typed ResolutionResponse."""
    entity = None
    if data.get("entity"):
        e = data["entity"]
        entity = Entity(
            display_name=e.get("display_name", ""),
            entity_type=e.get("entity_type"),
            jurisdiction=e.get("jurisdiction"),
            kyc_status=e.get("kyc_status"),
        )

    endpoints = []
    for ep in data.get("endpoints", []):
        endpoints.append(
            Endpoint(
                rail=ep.get("rail", ""),
                currency=ep.get("currency", "USD"),
                address=ep.get("address"),
                priority=ep.get("priority", 1),
                fee_estimate=ep.get("fee_estimate"),
                settlement_latency=ep.get("settlement_latency"),
                routing_metadata=ep.get("routing_metadata"),
            )
        )

    compliance = None
    if data.get("compliance"):
        c = data["compliance"]
        compliance = Compliance(
            sanctions_checked=c.get("sanctions_checked", False),
            fatf_risk_rating=c.get("fatf_risk_rating"),
            requires_purpose_code=c.get("requires_purpose_code", False),
        )

    return ResolutionResponse(
        resolution_id=data.get("resolution_id", ""),
        alias_uri=data.get("alias", ""),
        resolved_at=data.get("resolved_at", ""),
        ttl_seconds=data.get("ttl_seconds", 300),
        entity=entity,
        endpoints=endpoints,
        compliance=compliance,
        iso20022_hint=data.get("iso20022_hint"),
        resolution_status=data.get("resolution_status", "resolved"),
        caller_tier=data.get("caller_tier"),
        resolved_from=data.get("resolved_from", "origin"),
        agent_commerce=data.get("agent_commerce"),
        warnings=data.get("warnings", []),
    )
