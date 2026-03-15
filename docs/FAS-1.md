# FAS-1 — Financial Address Standard
## pay: URI Scheme Specification
### Version 0.1 — March 2026
### Status: Draft

---

## Abstract

FAS-1 defines the pay: URI scheme for
human-readable financial address resolution.
A pay: URI identifies a payment endpoint
without exposing underlying account details.

Example:
  pay:vendor.alpha
  pay:agent.compute
  pay:contractor.jay

---

## 1. URI Syntax

  pay-uri = "pay:" label *("." label)
  label   = 1*63(ALPHA / DIGIT / "-")

Rules:
  - Lowercase only
  - No leading or trailing hyphens
  - No consecutive dots
  - Maximum 128 characters total
  - Must start with pay:

Valid:
  pay:vendor.alpha
  pay:bank.jpmorgan.payments
  pay:agent.compute-01

Invalid:
  PAY:vendor.alpha    (uppercase)
  pay:.vendor         (leading dot)
  pay:vendor..alpha   (consecutive dots)

---

## 2. Resolution

A pay: URI resolves to a ResolutionResponse
containing:
  - entity metadata
  - ranked payment endpoints
  - preferred rail
  - ISO 20022 routing hint
  - compliance metadata

Resolution endpoint:
  GET /resolve/{pay-uri}

Response:
```json
{
  "alias": "pay:vendor.alpha",
  "entity": "Alpha Vendor Corp",
  "preferred_rail": "fednow",
  "endpoints": [
    {
      "rail": "fednow",
      "settle_seconds": 3,
      "fee_bps": 5,
      "currency": "USD"
    },
    {
      "rail": "ach",
      "settle_seconds": 86400,
      "fee_bps": 1,
      "currency": "USD"
    }
  ],
  "iso_hint": "pacs.008.001.08"
}
```

---

## 3. Namespace Structure

  pay:{namespace}.{identifier}

Reserved root namespaces:

| Namespace | Purpose |
|-----------|---------|
| pay:vendor.* | Commercial entities |
| pay:agent.* | Autonomous AI agents |
| pay:bank.* | Financial institutions |
| pay:platform.* | Payment platforms |
| pay:user.* | Individual users |
| pay:contract.* | Smart contracts |

Root namespace delegation:
  The root namespace authority may delegate
  sub-namespaces to qualified operators.
  Example:
    pay:bank.jpmorgan.* delegated to JPMorgan

---

## 4. Supported Rails

| Rail | Code | Settle Time |
|------|------|-------------|
| FedNow | fednow | 3 seconds |
| ACH | ach | 1-3 days |
| SWIFT | swift | 1-5 days |
| XRP Ledger | xrpl | 3-5 seconds |
| Crypto/Stablecoin | crypto | Instant |
| Card | card | 2 seconds |

---

## 5. Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| ALIAS_NOT_FOUND | 404 | No active record |
| ALIAS_SUSPENDED | 403 | Temporarily suspended |
| ENTITY_UNVERIFIED | 403 | KYC incomplete |
| ACCESS_DENIED | 403 | Not authorized |
| NO_VIABLE_RAIL | 422 | No rails available |
| RESOLVER_ERROR | 503 | Internal failure |

---

## 6. Authorization Tiers

| Level | Caller | Access |
|-------|--------|--------|
| 0 | Anonymous | No resolution |
| 1 | Verified human | Display name, rail type only |
| 2 | Authorized business | Full endpoint data |
| 3 | System / AI agent | Full response + routing metadata |

---

## 7. Protocol Compatibility

FAS-1 integrates with:

| Protocol | Owner | Integration |
|----------|-------|-------------|
| AP2 | Google + 60 partners | FAS-1 provides the address resolution layer AP2 explicitly identifies as missing |
| A2A | Google | Agents discovered via pay: addresses |
| MCP | Anthropic | pay: resolution as an MCP tool |
| x402 | Coinbase | XRPL rail via pay:agent.* addresses |

AP2 specification states:
> "Discoverability is a known gap. There is
> no way to register agents, name them, and
> convert those names into endpoints."

FAS-1 is the answer to that gap.

---

## 8. Reference Implementation

Project O — Financial Autonomy Stack
  https://github.com/dnsofmoney/dns-of-money

Genesis Transaction (proof of concept):
  First inter-AI payment — March 13 2026
  TX: B92C23BADE5864569F82BB65B60F84D3
      B6A8C59A75FC1E75B3DF2A5121A4DA77
  XRP Ledger mainnet. Immutable.

---

## 9. Authors

JD — DNS of Money
March 2026

---

## License

This specification is published under
Creative Commons Attribution 4.0 (CC BY 4.0).
You may use, share, and adapt this spec
with attribution.

Reference implementation: MIT License.

---

*FAS-1 v0.1 — Financial Address Standard*
*pay: URI Scheme Specification*
*March 2026*
