#!/usr/bin/env python3
"""
Resolve a pay: alias using the DNS of Money API.

pay: aliases are human-readable financial addresses defined by the FAS-1
specification. They resolve to payment endpoints across multiple rails
(ACH, FedNow, XRPL, SWIFT) — just like DNS resolves domain names to
IP addresses, but for payments.

    pay:vendor.alpha  →  { rail: "fednow", routing: "021000021", ... }
    pay:agent.compute →  { rail: "xrpl",   address: "rXXX...", ... }

This script shows how to resolve a pay: alias to its payment endpoints
using a simple HTTP GET request.

Requirements:
    pip install requests

Usage:
    python resolve.py
    API_KEY=your_key python resolve.py
"""

import os
import sys

import requests

BASE_URL = "https://api.dnsofmoney.com"
ALIAS = "pay:vendor.alpha"


def resolve(alias: str, api_key: str | None = None) -> dict:
    """
    Resolve a pay: alias to its payment endpoints.

    Args:
        alias: A FAS-1 pay: URI (e.g., "pay:vendor.alpha")
        api_key: Optional API key for authenticated resolution (higher tier)

    Returns:
        The full resolution response as a dict.
    """
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key

    resp = requests.get(f"{BASE_URL}/v1/resolve/{alias}", headers=headers)

    # Handle common error cases
    if resp.status_code == 404:
        print(f"Alias not found: {alias}")
        print(f"Error: {resp.json().get('detail', 'ALIAS_NOT_FOUND')}")
        sys.exit(1)

    if resp.status_code == 403:
        print(f"Resolution blocked (compliance): {resp.json().get('detail')}")
        sys.exit(1)

    resp.raise_for_status()
    return resp.json()


def main():
    api_key = os.environ.get("API_KEY")

    print(f"Resolving {ALIAS} ...")
    data = resolve(ALIAS, api_key)

    # --- Read the resolution response ---

    # Entity info: who owns this alias
    entity = data.get("entity", {})
    print(f"\nEntity:         {entity.get('display_name', 'N/A')}")
    print(f"Entity type:    {entity.get('entity_type', 'N/A')}")

    # Preferred rail: the recommended payment method
    preferred = data.get("preferred_rail", "N/A")
    print(f"Preferred rail: {preferred}")

    # ISO 20022 hint: which message family to use
    iso_hint = data.get("iso20022_hint", {})
    print(f"ISO 20022 hint: {iso_hint.get('message_type', 'N/A')}")

    # X-Resolved-From header: was this served from cache or origin?
    # (This header is on the HTTP response, not in the JSON body)
    # Access it via resp.headers["X-Resolved-From"] if using the raw response.

    # All available payment endpoints, ranked by priority
    endpoints = data.get("endpoints", [])
    print(f"\nEndpoints ({len(endpoints)}):")
    for ep in endpoints:
        rail = ep.get("rail", "unknown")
        priority = ep.get("priority", "?")
        currency = ep.get("currency", "USD")
        fee = ep.get("fee_estimate", "N/A")
        print(f"  [{priority}] {rail} ({currency}) — fee estimate: {fee}")

    # TTL: how long this resolution is valid
    ttl = data.get("ttl_seconds", 300)
    print(f"\nCache TTL: {ttl}s")
    print(f"Resolved at: {data.get('resolved_at', 'N/A')}")


if __name__ == "__main__":
    main()
