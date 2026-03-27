# FAS-1: Financial Address Standard
## `pay:` URI Scheme — Namespace, Resolution, and Anchoring Protocol

> *"There is a road, no simple highway"*

**Specification:** FAS-1
**Version:** v0.2  
**Status:** Draft  
**Date:** 2026-03-19  
**Authors:** DNS of Money Project  
**License:** CC BY 4.0  
**Repository:** https://github.com/dnsofmoney/dns-of-money

---

## Abstract

FAS-1 defines the `pay:` URI scheme — a human-readable financial address format that resolves to machine-executable payment instructions across multiple settlement rails. This specification covers alias syntax, namespace hierarchy, resolution protocol, on-chain anchoring via the XRP Ledger, and compatibility with AI agent payment protocols (AP2, A2A, MCP, x402).

The `pay:` scheme operates as a **metadata and resolution layer only**. It does not move funds, hold deposits, or act as a settlement institution.

---

## 1. Motivation

Payments today require routing numbers, account numbers, wallet addresses, and rail-specific identifiers that differ across ACH, FedNow, SWIFT, and blockchain networks. There is no universal, human-readable addressing standard that abstracts across these rails.

`pay:` is to payments what DNS is to the internet: a stable, human-readable namespace that resolves to the correct destination regardless of the underlying transport.

**Design goals:**

1. Human-readable and memorable financial addresses
2. Rail-agnostic resolution — one alias resolves across ACH, FedNow, SWIFT, XRPL, Solana
3. Machine-executable by AI agents with no human intervention
4. Immutable on-chain proof of registration via XRPL mainnet
5. Open, forkable standard with a controlled root namespace

---

## 2. URI Syntax

### 2.1 Format

```
pay:{namespace}.{identifier}
```

| Component | Rules |
|---|---|
| Scheme | Must be exactly `pay:` |
| Namespace | Lowercase letters, digits, hyphens; 1–63 characters; no leading/trailing hyphen |
| Separator | Single dot (`.`) |
| Identifier | Lowercase letters, digits, hyphens; 1–63 characters; no leading/trailing hyphen |
| Total length | Maximum 128 characters including `pay:` |

### 2.2 Formal Grammar (ABNF)

```abnf
pay-uri              = "pay:" segment *("." segment)
segment              = label-char 1*62label-char-or-hyphen
label-char           = ALPHA / DIGIT
label-char-or-hyphen = ALPHA / DIGIT / "-"
```

Consecutive dots (`..`) are not permitted. Single-label aliases (e.g., `pay:hempy`) and multi-label aliases (e.g., `pay:vendor.alpha`) are both valid.

### 2.3 Valid Examples

```
pay:vendor.alpha
pay:agent.compute
pay:hempy
pay:bank.acme
pay:platform.shopify
pay:user.alice
pay:enterprise.treasury
pay:contractor.jay
```

> **Note:** Single-label form (e.g., `pay:hempy`) is supported for direct registrations. Multi-label `namespace.identifier` form (e.g., `pay:vendor.alpha`) is also supported for hierarchical naming.

### 2.4 Invalid Examples

```
PAY:vendor.alpha      ← uppercase not permitted
pay:vendor..alpha     ← consecutive dots not permitted
pay:-vendor.alpha     ← leading hyphen not permitted
pay:vendor.alpha-     ← trailing hyphen not permitted
pay:ven dor.alpha     ← spaces not permitted
```

### 2.5 Naming Conventions

**People and brands:** use `firstlast` form (no dots) — e.g., `pay:elonmusk`, not `pay:elon.musk`. Dots imply hierarchy, not name structure.

**Hierarchical namespaces:** dots denote containment — e.g., `pay:agent.compute` means the `compute` entity within the `agent` namespace.

---

## 3. Namespace Hierarchy

### 3.1 Root Namespaces

Root namespaces are top-level wildcard identifiers registered and controlled by the DNS of Money registry. Only the specific namespaces and protected names listed in Appendix A return `ALIAS_RESERVED`. Other single-label aliases (e.g., `pay:hempy`) are available for registration.

**Reserved root namespaces:**

| Namespace | Purpose |
|---|---|
| `pay:vendor.*` | Commercial vendors and merchants |
| `pay:agent.*` | AI agents and autonomous systems |
| `pay:bank.*` | Licensed banking institutions |
| `pay:platform.*` | Payment platforms and SaaS providers |
| `pay:user.*` | Individual end users |
| `pay:contract.*` | Smart contracts and programmatic payees |
| `pay:enterprise.*` | Enterprise treasury accounts |
| `pay:dev.*` | Developer accounts and test identities |
| `pay:ai.*` | AI infrastructure providers |
| `pay:dao.*` | Decentralized autonomous organizations |

Root namespace registrations are anchored on XRPL mainnet **before** this open specification is published. Namespace ownership is the registry's foundational moat and cannot be forked once on-chain.

### 3.2 Entity Type Derivation

For multi-label aliases (e.g., `pay:vendor.alpha`), the `entity_type` is derived from the first label (the namespace). For single-label aliases (e.g., `pay:hempy`), the `entity_type` defaults to `personal`. Single-label aliases are fully eligible for all tiers including founding tier and NFT identity minting.

### 3.3 Dot Semantics

The dot (`.`) in `pay:` addresses is a **hierarchy separator only**. It does not imply DNS delegation, subdomain semantics, or network-level routing. All resolution is performed by the FAS-1 registry API.

### 3.4 Sub-namespace Delegation (Roadmap)

Sub-namespace delegation allows a namespace owner to grant registration rights within their namespace to third parties. For example, `pay:bank.acme` could allow Acme Bank to manage `pay:bank.acme.*` identifiers for their customers.

Delegation uses a parent-child `Namespace` table in the registry database. This is a Phase 2 feature and is not part of the v0.1 implementation.

---

## 4. Resolution Protocol

### 4.1 Overview

Resolution converts a `pay:` alias to a `ResolutionResponse` containing one or more payment endpoints, rail preferences, ISO 20022 metadata hints, and compliance signals.

**Resolution is read-only.** It never initiates, authorizes, or executes a payment.

### 4.2 Resolution Endpoint

```
GET /api/v1/resolve/{alias}
```

**Request headers:**

```
X-API-Key: fas_live_{key}
Accept: application/json
```

**Path parameter:** URL-encoded `pay:` URI (e.g., `pay:vendor.alpha`)

### 4.3 Resolution Response Schema

```json
{
  "alias": "pay:vendor.alpha",
  "resolved": true,
  "entity": {
    "display_name": "Alpha Vendors LLC",
    "entity_type": "vendor",
    "tier": "founding"
  },
  "endpoints": [
    {
      "rail": "fednow",
      "routing_number": "021000021",
      "account_type": "checking",
      "priority": 1
    },
    {
      "rail": "xrpl",
      "xrpl_address": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
      "destination_tag": 12345,
      "priority": 2
    }
  ],
  "iso20022_hint": {
    "message_type": "pacs.008",
    "service_level": "SEPA",
    "local_instrument": "INST",
    "charge_bearer": "SLEV"
  },
  "compliance": {
    "status": "clear",
    "screened_at": "2026-03-19T10:00:00Z",
    "travel_rule_required": false
  },
  "xrpl_anchor": {
    "tx_hash": "ABC123...",
    "ledger_index": 88123456,
    "anchored_at": "2026-03-19T09:00:00Z"
  },
  "ttl_seconds": 300,
  "resolved_at": "2026-03-19T10:00:00Z"
}
```

### 4.4 Resolution States

| `resolved` | Meaning |
|---|---|
| `true` | Alias is active and has at least one valid endpoint |
| `false` | Alias not found, inactive, or compliance-blocked |

When `resolved` is `false`, the response includes an `error_code` field.

### 4.5 Error Codes

| Error Code | HTTP | Meaning |
|---|---|---|
| `ALIAS_NOT_FOUND` | 404 | No alias matching this URI |
| `ALIAS_INACTIVE` | 410 | Alias exists but is deactivated |
| `COMPLIANCE_BLOCKED` | 403 | OFAC/sanctions hit — resolution blocked |
| `COMPLIANCE_PENDING` | 202 | Compliance screening in progress — retry |
| `INVALID_ALIAS_FORMAT` | 422 | URI fails FAS-1 syntax validation |
| `RATE_LIMITED` | 429 | Too many requests from this API key |

### 4.6 Caching

Resolvers SHOULD cache responses for `ttl_seconds`. The registry sets TTL based on entity type:

| Entity type | Default TTL |
|---|---|
| `vendor` | 300 seconds |
| `agent` | 60 seconds |
| `bank` | 3600 seconds |
| `user` | 120 seconds |

Implementations MUST re-resolve after TTL expiry. Stale cache MUST NOT be used for high-value payments (> $10,000 USD equivalent).

---

## 5. Registration Protocol

### 5.1 Registration Endpoint

```
POST /api/v1/aliases/register
Content-Type: application/json
X-API-Key: fas_live_{key}
```

**Request body:**

```json
{
  "alias_name": "pay:vendor.alpha",
  "display_name": "Alpha Vendors LLC",
  "xrpl_address": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "payment_tx_hash": "ABCDEF...",
  "preferred_rail": "fednow",
  "routing_number": "021000021",
  "account_number": "9876543210",
  "account_type": "checking"
}
```

### 5.2 Registration Validation

All five checks must pass before a registration is committed. No partial writes occur.

| Step | Check |
|---|---|
| 1 | **FAS-1 format** — alias passes syntax validation per Section 2 |
| 2 | **Availability** — alias is not `taken` or `reserved` |
| 3 | **Payment verification** — `payment_tx_hash` is a validated XRPL transaction of the correct fee to the registry wallet from `xrpl_address` |
| 4 | **Cap check** — founding tier count < 500 (atomic `SELECT FOR UPDATE`) |
| 5 | **Wallet uniqueness** — `xrpl_address` has not already registered a founding tier name |

### 5.3 Availability Check

```
GET /api/v1/aliases/check/{alias_name}
```

No authentication required. Returns one of three states:

```json
{ "status": "available" }
{ "status": "taken" }
{ "status": "reserved" }
```

### 5.4 Registration Error Codes

| Error Code | HTTP | Meaning |
|---|---|---|
| `INVALID_ALIAS_FORMAT` | 422 | Fails FAS-1 syntax |
| `ALIAS_TAKEN` | 409 | Already registered |
| `ALIAS_RESERVED` | 409 | Root or protected namespace |
| `FOUNDING_CAP_REACHED` | 409 | 500-name founding cap is full |
| `WALLET_ALREADY_REGISTERED` | 409 | This XRPL address already has a founding name |
| `PAYMENT_NOT_VERIFIED` | 402 | TX hash not found on-chain or not yet validated |
| `PAYMENT_INSUFFICIENT` | 402 | Payment amount below required fee |
| `PAYMENT_WRONG_SENDER` | 402 | TX sender does not match `xrpl_address` |

---

## 6. Founding Tier

### 6.1 Parameters

| Parameter | Value |
|---|---|
| Total founding slots | 500 |
| Fee | 5 XRP (flat) |
| Names per wallet | 1 |
| Grandfathering | Permanent — founding tier is encoded on-chain and cannot be revoked |
| Anchor | XRPL mainnet memo TX |

### 6.2 Founding Tier XRPL Memo Schema

Every founding tier registration is anchored on XRPL mainnet via a 1-drop payment with a structured Memo field.

**Memo JSON:**

```json
{
  "p": "FAS-1",
  "v": "1.0",
  "t": "founding",
  "a": "pay:vendor.alpha",
  "w": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "ts": "2026-03-19T10:00:00Z",
  "n": 42
}
```

| Field | Description |
|---|---|
| `p` | Protocol identifier — always `FAS-1` |
| `v` | FAS-1 spec version |
| `t` | Registration tier — `founding`, `standard`, `enterprise` |
| `a` | The `pay:` alias being registered |
| `w` | Registrant XRPL wallet address |
| `ts` | ISO 8601 timestamp of registration |
| `n` | Sequence number within the founding cohort (1–500) |

**XRPL Memo encoding:**

```
MemoType:   hex("FAS-1")              → 4641532D31
MemoFormat: hex("application/json")
MemoData:   hex(minified JSON string)
```

The Memo JSON is minified before hex encoding. The `n` field is assigned atomically at INSERT time and represents the registrant's immutable position in the founding cohort.

---

## 7. On-Chain Anchoring

### 7.1 XRPL Memo Transaction Pattern

FAS-1 uses XRPL Payment transactions with structured Memo fields as immutable on-chain proofs of registration. This is not NFT minting (NFT identity anchoring is a Phase 2 feature).

**Transaction parameters:**

```
TransactionType: Payment
Account:         registry_wallet
Destination:     registry_wallet   ← self-payment (1 drop)
Amount:          "1"               ← 1 drop XRP
Memos:
  - MemoType:   "4641532D31"       ← hex("FAS-1")
    MemoFormat: "6170706C..."      ← hex("application/json")
    MemoData:   "7B2270223A..."    ← hex(minified JSON)
```

### 7.2 Verification

Any party can verify a registration without access to the FAS-1 registry API:

1. Fetch the XRPL transaction by `tx_hash` from any XRPL node or explorer
2. Decode `MemoData` from hex to UTF-8 JSON
3. Confirm `p === "FAS-1"`, `a === alias`, `w === registrant_address`
4. Confirm the transaction status is `tesSUCCESS` and is validated on the ledger

This provides trustless, permissionless proof of registration.

### 7.3 Async Memo Submission

Memo TX submission is **fire-and-forget** from the registration flow. The alias is live immediately after the database commit. If the memo TX fails, it is queued for retry. Registration is never rolled back due to memo TX failure — the on-chain anchor is proof of registration, not a prerequisite for it.

---

## 8. ISO 20022 Compatibility

### 8.1 Resolution Hints

The `iso20022_hint` field in the resolution response provides structured metadata for ISO 20022 message construction. These are hints — not fully-formed messages. Message construction is the responsibility of the payment orchestration layer.

| Hint field | ISO 20022 mapping |
|---|---|
| `message_type` | Identifies target message family (pacs.008, pain.001, etc.) |
| `service_level` | `SvcLvl/Cd` |
| `local_instrument` | `LclInstrm/Cd` |
| `charge_bearer` | `ChrgBr` |

### 8.2 Supported Message Families

| Message | Use case |
|---|---|
| `pacs.008` | FI-to-FI customer credit transfer (FedNow, SWIFT) |
| `pain.001` | Customer credit transfer initiation (ACH) |
| `pacs.002` | Payment status report |
| `camt.053` | Bank-to-customer statement |
| `camt.054` | Bank-to-customer debit/credit notification |

### 8.3 End-to-End Traceability

Every FAS-1 resolution event emits a `resolution_id` (UUID) that maps to the `EndToEndId` field in the downstream ISO 20022 message. This enables full audit trail from alias resolution through settlement.

---

## 9. AI Agent Compatibility

FAS-1 is designed as native infrastructure for the machine economy. Aliases are the primary addressing primitive for AI agent payments.

### 9.1 The Agent Address Resolution Gap

AP2 (Agent Payment Protocol) version 2 identifies a structural gap in agentic commerce infrastructure:

> *"Discoverability is a known gap. There is no way to register agents, name them, and convert those names into payment endpoints."*

FAS-1 is the resolution layer that closes this gap. Any agent can register a `pay:` alias. Any caller can resolve it to a ranked list of payment endpoints without prior knowledge of the agent's banking infrastructure.

### 9.2 A2A-031 Binding Pattern

FAS-1 integrates natively with A2A-031 (Financial Address Resolution Binding):

```
A2A Identity → payment_alias → FAS-1 resolver → ResolutionResponse
  → rail selection → settlement instruction → payment receipt
```

Agent card with payment alias:
```json
{
  "agent_id": "AGT-COMPUTE-001",
  "payment_alias": "pay:agent.compute"
}
```

### 9.3 Agent Resolution Flow

```
AI Agent
  │
  ├─ Resolves: GET /api/v1/resolve/pay:vendor.alpha
  │
  ├─ Receives: ResolutionResponse
  │             endpoints, preferred_rail, iso20022_hint
  │
  ├─ Selects: highest-priority available rail
  │
  └─ Executes: payment via Layer 3 router
               (not FAS-1's responsibility)
```

Resolution never executes payments. The resolver maps `pay:alias` → payment instruction. Execution is the caller's responsibility.

### 9.4 MCP Tool Surface (Roadmap)

A FAS-1 MCP server will expose the following tools to AI agents:

```
resolve_alias(alias: str)        → ResolutionResponse
check_availability(alias: str)   → AvailabilityStatus
list_endpoints(alias: str)       → List[PaymentEndpoint]
```

### 9.5 x402 Integration (Roadmap)

FAS-1 aliases will be accepted as the `X-Payment-Destination` header in the x402 payment-required protocol. When a server returns `402 Payment Required` with a `pay:` alias, a compatible agent resolves the alias and completes payment autonomously.

---

## 10. Security Considerations

### 10.1 Payment Verification

The registry MUST verify XRPL payment TX hashes on-chain before committing any registration. The API MUST NOT trust client-provided amount claims. Amount is read directly from the validated ledger transaction.

Implementation MUST call a ledger verification function (e.g., `_verify_tx_on_ledger()`) before trusting any XRPL transaction result.

### 10.2 Founding Cap Atomicity

The 500-name founding cap MUST be enforced with `SELECT ... FOR UPDATE` inside the same database transaction as the INSERT. Enforcing the cap check and INSERT in separate transactions creates a race condition that allows cap overflow.

### 10.3 Wallet Uniqueness

The one-name-per-wallet constraint MUST be enforced at the database level via a partial unique index:

```sql
CREATE UNIQUE INDEX uq_founding_xrpl_wallet
  ON aliases (founding_xrpl_address)
  WHERE tier = 'founding';
```

Application-layer checks are a first-pass guard only. The database constraint is the authoritative enforcement mechanism.

### 10.4 OFAC / Sanctions Screening

Resolution requests MUST be screened against OFAC sanctions lists. A positive hit returns `COMPLIANCE_BLOCKED` (403). Screening results are cached for 24 hours maximum. Fresh screening is required after the 24h TTL.

### 10.5 Travel Rule

Payments routed through FAS-1-resolved endpoints that exceed jurisdictional thresholds (typically USD 3,000 domestic, USD 1,000 international) MUST include Travel Rule data. The `iso20022_hint` field includes `travel_rule_required: true` when the resolved entity's jurisdiction triggers this requirement.

---

## 11. Versioning

| Version | Status | Notes |
|---|---|---|
| v0.1 | Implemented | Core alias format, registration, resolution, XRPL memo anchor |
| v0.2 | Draft | AP2 integration section, founding tier fields, compliance signals |
| v1.0 | Planned | Stable release — NFT identity anchoring, sub-namespace delegation, MCP tool surface |

Breaking changes to the URI syntax, resolution response schema, or XRPL memo schema require a version increment. New optional response fields are non-breaking.

---

## Appendix A: Reserved Namespaces

Attempts to register any of the following return `ALIAS_RESERVED`.

**Root namespace wildcards:**

```
pay:bank.*       pay:agent.*      pay:platform.*
pay:vendor.*     pay:user.*       pay:contract.*
pay:enterprise.* pay:dev.*        pay:ai.*
pay:dao.*
```

**Protected single-label names (explicit list — unlisted single-label names like `pay:hempy` are available):**

```
pay:pay     pay:money    pay:cash      pay:send
pay:receive pay:transfer pay:dns       pay:root
pay:admin   pay:system   pay:api       pay:test
pay:null
```

---

## Appendix B: Validation Reference

```python
import re

FAS1_PATTERN = re.compile(
    r'^pay:[a-z0-9][a-z0-9\-]*(\.[a-z0-9][a-z0-9\-]*)*$'
)
MAX_LENGTH = 128

def is_valid_fas1(alias: str) -> bool:
    if len(alias) > MAX_LENGTH:
        return False
    if ".." in alias:
        return False
    return bool(FAS1_PATTERN.match(alias))
```

---

## Appendix C: Resolution Response JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://spec.dnsofmoney.com/fas-1/resolution-response.json",
  "title": "FAS-1 Resolution Response",
  "type": "object",
  "required": ["alias", "resolved", "resolved_at"],
  "properties": {
    "alias": {
      "type": "string",
      "pattern": "^pay:"
    },
    "resolved": {
      "type": "boolean"
    },
    "entity": {
      "type": "object",
      "properties": {
        "display_name": { "type": "string" },
        "entity_type": {
          "type": "string",
          "enum": ["vendor","agent","bank","platform","user","contract","enterprise","dev","ai","dao","personal"]
        },
        "tier": {
          "type": "string",
          "enum": ["founding","standard","enterprise"]
        }
      }
    },
    "endpoints": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rail","priority"],
        "properties": {
          "rail": {
            "type": "string",
            "enum": ["ach","fednow","swift","xrpl","solana","card"]
          },
          "priority": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "iso20022_hint": { "type": "object" },
    "compliance": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["clear","pending","blocked"]
        },
        "travel_rule_required": { "type": "boolean" }
      }
    },
    "ttl_seconds": { "type": "integer", "minimum": 0 },
    "resolved_at": { "type": "string", "format": "date-time" }
  }
}
```

---

## Appendix D: On-Chain Namespace Anchors

The following root namespaces are anchored on XRPL mainnet as of the publication date of this spec. All anchors were submitted before FAS-1 was published as an open standard.

| Alias | Anchor Date | XRPL TX Hash |
|---|---|---|
| `pay:agent.*` | 2026-03-17 | `B348F492776225...` |
| `pay:swift` | 2026-03-18 | _(see registry)_ |
| `pay:fednow` | 2026-03-18 | _(see registry)_ |
| `pay:fedreserve` | 2026-03-18 | _(see registry)_ |
| `pay:iso20022` | 2026-03-18 | _(see registry)_ |
| `pay:cbdc` | 2026-03-18 | _(see registry)_ |
| `pay:treasury` | 2026-03-18 | _(see registry)_ |
| `pay:bis` | 2026-03-18 | _(see registry)_ |
| `pay:imf` | 2026-03-18 | _(see registry)_ |
| `pay:worldbank` | 2026-03-18 | _(see registry)_ |
| `pay:correspondent` | 2026-03-18 | _(see registry)_ |
| `pay:nostro` | 2026-03-18 | _(see registry)_ |
| `pay:vostro` | 2026-03-18 | _(see registry)_ |
| `pay:fedwire` | 2026-03-18 | _(see registry)_ |
| `pay:chips` | 2026-03-18 | _(see registry)_ |
| `pay:chaps` | 2026-03-18 | _(see registry)_ |
| `pay:target2` | 2026-03-18 | _(see registry)_ |
| `pay:cips` | 2026-03-18 | _(see registry)_ |
| `pay:ripplenet` | 2026-03-18 | _(see registry)_ |
| `pay:odl` | 2026-03-18 | _(see registry)_ |
| `pay:swift.usd` | 2026-03-18 | _(see registry)_ |
| `pay:swift.eur` | 2026-03-18 | _(see registry)_ |

Full anchor inventory with TX hashes: [NAMESPACE-REGISTRY.md](NAMESPACE-REGISTRY.md)

---

*FAS-1 v0.2 Draft · DNS of Money Project · CC BY 4.0*
*Financial orchestration infrastructure for the machine economy.*
*We are not a bank. We are the layer above it.*

---

<p align="center">
  <em>"In Franklin's tower the four winds sleep."</em><br>
  — Franklin's Tower, Grateful Dead
</p>
