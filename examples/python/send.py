#!/usr/bin/env python3
"""
Send money to a pay: alias using the DNS of Money API.

pay: aliases are human-readable financial addresses. Instead of sending
money to a 34-character XRPL address or a routing+account number pair,
you send to a name:

    pay:dnsofmoney  →  resolves to XRPL address  →  payment settles in ~4s

This script demonstrates two operations:
    1. Preview — dry-run that shows where money would go (no auth required)
    2. Send   — execute a real payment (requires API key)

Requirements:
    pip install requests

Usage:
    # Preview only (no API key needed):
    python send.py

    # Execute a real payment:
    API_KEY=fas_live_... python send.py --execute
"""

import os
import secrets
import sys

import requests

BASE_URL = "https://api.dnsofmoney.com"
ALIAS = "pay:dnsofmoney"


def preview(alias: str) -> dict:
    """
    Preview where a payment would go — no auth, no execution.

    Returns:
        dict with alias, resolved, destination_address (masked), rail,
        fee_estimate, and identity (NFT info).
    """
    resp = requests.get(f"{BASE_URL}/api/v1/send/preview/{alias}")

    if resp.status_code == 404:
        print(f"Alias not found: {alias}")
        sys.exit(1)

    resp.raise_for_status()
    return resp.json()


def send(alias: str, amount: float, api_key: str, memo: str = "") -> dict:
    """
    Send money to a pay: alias.

    The API resolves the alias globally, runs compliance screening,
    selects the best payment rail, generates an ISO 20022 message,
    and executes settlement.

    Args:
        alias: Target pay: alias.
        amount: Amount in USD.
        api_key: Your DNS://Money API key.
        memo: Optional payment memo.

    Returns:
        dict with transaction_id, status, tx_hash, rail, settle_time_seconds.
    """
    # Generate a unique idempotency key to prevent double-send.
    # In production, derive this from your own transaction reference.
    idempotency_key = f"example-{secrets.token_hex(16)}"

    resp = requests.post(
        f"{BASE_URL}/api/v1/send",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "alias": alias,
            "amount": amount,
            "currency": "USD",
            "memo": memo,
            "idempotency_key": idempotency_key,
        },
    )

    if resp.status_code == 401:
        print("Error: Invalid API key. Request one at https://dnsofmoney.com/request-access")
        sys.exit(1)
    if resp.status_code == 404:
        print(f"Error: Alias not found: {alias}")
        sys.exit(1)
    if resp.status_code == 402:
        print(f"Error: Payment blocked (compliance): {resp.json()}")
        sys.exit(1)
    if resp.status_code == 422:
        print(f"Error: No viable payment rail: {resp.json()}")
        sys.exit(1)

    resp.raise_for_status()
    return resp.json()


def main():
    execute = "--execute" in sys.argv
    api_key = os.environ.get("API_KEY")

    # ── Step 1: Preview ──────────────────────────────────────────────────
    print(f"Previewing {ALIAS} ...")
    data = preview(ALIAS)

    print(f"\n  Alias:       {data['alias']}")
    print(f"  Resolved:    {data['resolved']}")
    print(f"  Destination: {data.get('destination_address', 'N/A')}")
    print(f"  Rail:        {data.get('rail', 'N/A')}")
    print(f"  Currency:    {data.get('currency', 'N/A')}")
    print(f"  Fee est.:    {data.get('fee_estimate', 'N/A')}")

    identity = data.get("identity")
    if identity:
        print(f"  NFT:         {identity.get('nft_token_id', 'N/A')[:16]}...")
        print(f"  Tier:        {identity.get('tier', 'N/A')}")

    # ── Step 2: Send (only with --execute and API_KEY) ───────────────────
    if not execute:
        print("\nDry run complete. To send a real payment:")
        print("  API_KEY=fas_live_... python send.py --execute")
        return

    if not api_key:
        print("\nError: API_KEY environment variable required for --execute.")
        print("Request a key at: https://dnsofmoney.com/request-access")
        sys.exit(1)

    print(f"\nSending $5.00 to {ALIAS} ...")
    result = send(ALIAS, amount=5.00, api_key=api_key, memo="SDK example payment")

    print(f"\n  TX ID:       {result['transaction_id']}")
    print(f"  Status:      {result['status']}")
    print(f"  Rail:        {result['rail']}")
    print(f"  TX hash:     {result.get('tx_hash', 'N/A')}")
    print(f"  Settled in:  {result.get('settle_time_seconds', 'N/A')}s")


if __name__ == "__main__":
    main()
