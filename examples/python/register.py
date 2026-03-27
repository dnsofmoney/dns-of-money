#!/usr/bin/env python3
"""
Register a new pay: alias using the DNS of Money API.

This script shows how to register a pay: alias — a human-readable
financial address that resolves to your payment endpoints.

Before registering, you need:
  1. An API key (X-API-Key header)
  2. A valid FAS-1 alias name (e.g., "pay:yourcompany.payments")
  3. At least one payment endpoint (routing number, XRPL address, etc.)

For founding tier registration (first 500 names at 5 XRP):
  - You also need an XRPL wallet address and a verified 5 XRP payment TX hash.

Requirements:
    pip install requests

Usage:
    API_KEY=your_key python register.py
"""

import os
import sys

import requests

BASE_URL = "https://api.dnsofmoney.com"


def check_availability(alias_name: str) -> str:
    """
    Check if an alias name is available for registration.
    No authentication required.

    Returns: "available", "taken", or "reserved"
    """
    # Strip the "pay:" prefix for the availability endpoint
    name = alias_name.removeprefix("pay:")
    resp = requests.get(f"{BASE_URL}/v1/aliases/available/{name}")
    resp.raise_for_status()
    return resp.json().get("status", "unknown")


def register_alias(api_key: str) -> dict:
    """Register a new pay: alias with the DNS of Money registry."""

    body = {
        # Required: the pay: alias you want to register
        # Must follow FAS-1 format: pay:{namespace}.{identifier}
        # Lowercase only, no spaces, dots are hierarchy separators
        "alias_name": "pay:yourcompany.payments",

        # Required: human-readable name shown during resolution
        "display_name": "Your Company LLC",

        # Required: your preferred payment rail
        # Options: "fednow", "ach", "xrpl", "swift", "card"
        "preferred_rail": "fednow",

        # Conditional: required for ACH/FedNow rails
        "routing_number": "021000021",
        "account_number": "9876543210",
        "account_type": "checking",  # "checking" or "savings"

        # Conditional: required for XRPL rail
        # "xrpl_address": "rYourXRPLAddress...",
        # "destination_tag": 12345,  # optional
    }

    resp = requests.post(
        f"{BASE_URL}/v1/aliases",
        json=body,
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
    )

    # Handle registration errors
    if resp.status_code == 409:
        error = resp.json()
        code = error.get("error_code", "CONFLICT")
        print(f"Registration failed: {code}")
        print(f"Detail: {error.get('detail', 'Alias already taken or reserved')}")
        sys.exit(1)

    if resp.status_code == 422:
        print(f"Invalid alias format: {resp.json().get('detail')}")
        sys.exit(1)

    resp.raise_for_status()
    return resp.json()


def main():
    api_key = os.environ.get("API_KEY")
    if not api_key:
        print("Error: Set the API_KEY environment variable.")
        print("  API_KEY=fas_live_... python register.py")
        sys.exit(1)

    alias_name = "pay:yourcompany.payments"

    # Step 1: Check availability (no auth needed)
    print(f"Checking availability of {alias_name} ...")
    status = check_availability(alias_name)
    print(f"Status: {status}")

    if status == "taken":
        print("This alias is already registered. Choose a different name.")
        sys.exit(1)

    if status == "reserved":
        print("This alias is reserved (listed in Appendix A protected names).")
        sys.exit(1)

    # Step 2: Register the alias
    print(f"\nRegistering {alias_name} ...")
    result = register_alias(api_key)

    print(f"\nRegistered successfully!")
    print(f"  Alias: {result.get('alias_name')}")
    print(f"  ID:    {result.get('id')}")
    print(f"  Rail:  {result.get('preferred_rail')}")


if __name__ == "__main__":
    main()
