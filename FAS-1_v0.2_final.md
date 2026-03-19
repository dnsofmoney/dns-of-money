# FAS-1: Financial Address Standard
## pay: URI Scheme — Namespace, Resolution, and Anchoring Protocol

**Specification:** FAS-1  
**Status:** Active v0.2  
**Date:** 2026-03-19  
**Authors:** DNS of Money Project  
**License:** Apache 2.0  
**Repository:** https://github.com/dnsofmoney/dns-of-money

---

## Abstract

FAS-1 defines the `pay:` URI scheme — a human-readable financial address format that resolves to machine-executable payment instructions across multiple settlement rails. This specification covers alias syntax, namespace hierarchy, resolution protocol, on-chain anchoring via the XRP Ledger, and compatibility with AI agent payment protocols (AP2, A2A, MCP, x402).

The `pay:` scheme operates as a metadata and resolution layer only. It does not move funds, hold deposits, or act as a settlement institution.

---

## 1. Motivation

Payments today require routing numbers, account numbers, wallet addresses, and rail-specific identifiers that differ across ACH, FedNow, SWIFT, and blockchain networks. There is no universal, human-readable addressing standard that abstracts across these rails.

`pay:` is to payments what DNS is to the internet: a stable, human-readable namespace that resolves to the correct destination regardless of the underlying transport.

**Design goals:**

1. Human-readable and memorable financial addresses
2. Rail-agnostic resolution — one alias resolves across ACH, FedNow, SWIFT, XRPL, Solana
3. Machine-executable by AI agents with no human intervention
4. Immutable on-chain proof of registration via XRPL
5. Open, forkable standard with a controlled root namespace

---

## 2. URI Syntax

### 2.1 Format

```
pay:{namespace}.{identifier}
```

| Component | Rules |
|---|---|
| Scheme | Must be exactly `pay:` (case-insensitive input is normalised to lowercase) |
| Namespace | Lowercase letters, digits, hyphens; 1–63 characters; no leading/trailing hyphen |
| Separator | Single dot (`.`) |
| Identifier | Lowercase letters, digits, hyphens; 1–63 characters; no leading/trailing hyphen |
| Total length | Maximum 128 characters including `pay:` |

### 2.2 Formal Grammar (ABNF)

```abnf
pay-uri       = "pay:" segment *("." segment)
segment       = label-char 1*62label-char-or-hyphen
label-char    = ALPHA / DIGIT
label-char-or-hyphen = ALPHA / DIGIT / "-"
```

Consecutive dots (`..`) are not permitted. The URI must contain at least one dot after `pay:`.

### 2.3 Normalisation

Implementations MUST apply Unicode NFKC normalisation and lowercase transformation before validation. `PAY:Vendor.Alpha` normalises to `pay:vendor.alpha`. Input containing non-standard Unicode characters after normalisation MUST be rejected with `INVALID_ALIAS_FORMAT`.

### 2.4 Valid Examples

```
pay:vendor.alpha
pay:agent.compute
pay:bank.acme
pay:platform.shopify
pay:user.alice
pay:user.javaris
pay:vendor.my-shop
```

### 2.5 Invalid Examples

```
pay:vendor           ← single-label reserved for root namespaces
pay:vendor..alpha    ← consecutive dots
pay:-vendor.alpha    ← leading hyphen
pay:vendor.alpha-    ← trailing hyphen
pay:ven dor.alpha    ← spaces not permitted
```

---

## 3. Namespace Hierarchy

### 3.1 On-Chain Namespace Inventory

All 41 reserved names are anchored on XRPL mainnet as of 2026-03-19. These records are immutable and timestamped on-chain. Registration attempts against any of these names return `ALIAS_RESERVED`.

**Category 1 — FAS-1-NS Root Wildcards (6)**  
Anchored as `pay:{name}.*` in the XRPL memo. Grants exclusive sub-registration rights — no one may register `pay:bank.anything` without going through the DNS of Money registry.

| Namespace | Purpose |
|---|---|
| `pay:bank.*` | Licensed banking institutions |
| `pay:agent.*` | AI agents and autonomous systems |
| `pay:platform.*` | Payment platforms and SaaS providers |
| `pay:vendor.*` | Commercial vendors and merchants |
| `pay:user.*` | Individual end users |
| `pay:contract.*` | Smart contracts and programmatic payees |

**Category 2 — Reserved Premium (15)**  
High-value single-label names under permanent registry control.

`pay:ai` · `pay:api` · `pay:contractor` · `pay:corp` · `pay:dao` · `pay:dev` · `pay:dns` · `pay:edu` · `pay:enterprise` · `pay:fas` · `pay:freelance` · `pay:gov` · `pay:llm` · `pay:treasury` · `pay:wallet`

**Category 3 — Reserved Defensive (20)**  
Institutional and payment-rail moat anchors. Prevents namespace squatting on settlement infrastructure identifiers.

`pay:bis` · `pay:cbdc` · `pay:chaps` · `pay:chips` · `pay:cips` · `pay:correspondent` · `pay:fednow` · `pay:fedreserve` · `pay:fedwire` · `pay:imf` · `pay:iso20022` · `pay:nostro` · `pay:odl` · `pay:ripplenet` · `pay:swift` · `pay:swift.eur` · `pay:swift.usd` · `pay:target2` · `pay:vostro` · `pay:worldbank`

**Additional protected single-label aliases:**  
`pay:pay` · `pay:money` · `pay:cash` · `pay:send` · `pay:receive` · `pay:transfer` · `pay:root` · `pay:admin` · `pay:system` · `pay:test` · `pay:null`

### 3.2 Sub-namespace Delegation (Roadmap)

Sub-namespace delegation allows a namespace owner to grant registration rights within their namespace to third parties. For example, `pay:bank.acme` could allow Acme Bank to register `pay:bank.acme.*` sub-identifiers for their customers.

Delegation uses a parent-child `Namespace` table in the registry database. This is a Phase 2 feature and is not part of the v0.1 implementation.

### 3.3 Dot Semantics

The dot (`.`) in `pay:` addresses is a **hierarchy separator only**. It does not imply DNS delegation, subdomain semantics, or any network-level routing. All resolution is performed by the FAS-1 registry API.

---

## 4. Resolution Protocol

### 4.1 Overview

Resolution converts a `pay:` alias to a `ResolutionResponse` containing one or more payment endpoints, rail preferences, ISO 20022 metadata hints, and compliance signals.

Resolution is **read-only**. It never initiates, authorizes, or executes a payment.

### 4.2 Resolution Endpoint

```
GET /api/v1/resolve/{alias}
```

**Request headers:**

```
X-API-Key: fas_live_{key}
Accept: application/json
```

**Path parameter:**

```
alias: URL-encoded pay: URI (e.g., pay:vendor.alpha)
```

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
| `ALIAS_RESERVED` | 409 | Name is reserved — cannot be registered |
| `ALIAS_BLOCKED` | 422 | Name violates content policy — cannot be registered |
| `COMPLIANCE_BLOCKED` | 403 | OFAC/sanctions hit — resolution blocked |
| `COMPLIANCE_PENDING` | 202 | Compliance screening in progress — retry |
| `INVALID_ALIAS_FORMAT` | 422 | URI fails FAS-1 syntax validation |
| `RATE_LIMITED` | 429 | Too many requests from this API key |

`ALIAS_RESERVED` and `ALIAS_BLOCKED` are distinct codes. `ALIAS_RESERVED` indicates a business or moat restriction. `ALIAS_BLOCKED` indicates a content policy restriction. Implementations MUST NOT conflate them.

### 4.6 Validation Evaluation Order

The alias validator evaluates checks in this order. Evaluation stops at the first failure.

| Step | Check | Error code on failure |
|---|---|---|
| 1 | Type check — input must be a string | `INVALID_ALIAS_FORMAT` |
| 2 | Unicode NFKC normalisation — reject non-standard characters | `INVALID_ALIAS_FORMAT` |
| 3 | Scheme — must start with `pay:` after normalisation | `INVALID_ALIAS_FORMAT` |
| 4 | Length — max 128 characters | `INVALID_ALIAS_FORMAT` |
| 5 | No consecutive dots | `INVALID_ALIAS_FORMAT` |
| 6 | Reserved check — single-label reserved names caught before regex | `ALIAS_RESERVED` |
| 7 | Regex — FAS-1 format, charset, and structure | `INVALID_ALIAS_FORMAT` |
| 8 | Content policy — blocked terms (slurs, hate speech) | `ALIAS_BLOCKED` |

Step 6 (reserved) runs before step 7 (regex) because reserved single-label names such as `pay:swift` would fail the regex (no dot) before reaching the reserved check, producing a misleading format error.

### 4.7 Caching

Resolvers SHOULD cache responses for `ttl_seconds`. The registry sets TTL based on entity type:

| Entity type | Default TTL |
|---|---|
| `vendor` | 300 seconds |
| `agent` | 60 seconds |
| `bank` | 3600 seconds |
| `user` | 120 seconds |

Implementations MUST re-resolve after TTL expiry. Stale cache hits MUST NOT be used for high-value payments (> $10,000).

---

## 5. Registration Protocol

### 5.1 Alias Registration Endpoint

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

### 5.2 Registration Validation Steps

All five checks must pass before a registration is committed:

1. **FAS-1 format** — alias passes syntax validation per §4.6 (all 8 steps)
2. **Availability** — alias is not `taken` or `reserved`
3. **Payment verification** — `payment_tx_hash` is a validated XRPL transaction of the correct fee to the registry wallet from `xrpl_address`
4. **Cap check** — founding tier count < 500 (atomic `SELECT FOR UPDATE`)
5. **Wallet uniqueness** — `xrpl_address` has not already registered a founding tier name

Failure of any check returns immediately with the specific error code. No partial writes occur.

### 5.3 Availability Check

```
GET /api/v1/aliases/check/{alias_name}
```

No authentication required. Returns one of exactly three states:

```json
{ "status": "available" }
{ "status": "taken" }
{ "status": "reserved" }
```

Never any other string. Frontend and SDK clients depend on this exact enum.

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
  "type": "FAS-1",
  "alias": "pay:vendor.alpha",
  "tier": "founding",
  "xrpl_address": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "registered_at": "2026-03-19T10:00:00Z"
}
```

| Field | Description |
|---|---|
| `type` | Protocol identifier — always `FAS-1` |
| `alias` | The `pay:` alias being registered |
| `tier` | Registration tier — `founding`, `standard`, or `enterprise` |
| `xrpl_address` | Registrant XRPL wallet address |
| `registered_at` | ISO 8601 UTC timestamp of registration |

**XRPL Memo encoding:**

```
MemoType:   hex("FAS-1")             → 4641532D31
MemoFormat: hex("application/json")
MemoData:   hex(<minified JSON>)
```

---

## 7. On-Chain Anchoring

### 7.1 Registration Anchor Pattern

FAS-1 uses XRPL Payment transactions with structured Memo fields as immutable on-chain proofs of registration. Phase 1 uses Payment+Memo. NFT identity anchoring is a Phase 2 feature.

**Transaction parameters:**

```
TransactionType: Payment
Account:         registry_wallet
Destination:     registry_wallet   ← self-payment (1 drop)
Amount:          "1"               ← 1 drop XRP
LastLedgerSequence: current + 20  ← ~60 second safety window
Memos: [{ Memo: { MemoType, MemoFormat, MemoData } }]
```

### 7.2 Namespace Anchor Pattern

Root namespace and reserved name anchors use a separate memo type `FAS-1-NS` with the following schema:

```json
{
  "type": "FAS-1-NS",
  "name": "pay:bank.*",
  "category": "wildcard",
  "owner": "DNS of Money",
  "anchored_at": "2026-03-19T10:00:00Z"
}
```

The `category` field is one of `wildcard`, `premium`, or `defensive` as defined in §3.1.

### 7.3 Trustless Verification

Any party can verify a registration by:

1. Fetching the XRPL transaction by `tx_hash`
2. Decoding `MemoData` from hex to UTF-8 JSON
3. Confirming `type === "FAS-1"`, `alias === <expected>`, `xrpl_address === <registrant>`
4. Confirming the transaction is validated on the ledger

This provides trustless, permissionless proof of registration without requiring access to the FAS-1 registry API.

### 7.4 Async Memo Submission

Memo TX submission is **fire-and-forget** from the registration flow. The alias is active immediately after the database commit. If the memo TX fails, it is queued for retry. Registration is never rolled back due to memo TX failure.

---

## 8. ISO 20022 Compatibility

### 8.1 Resolution Hints

The `iso20022_hint` field provides structured metadata for ISO 20022 message construction. These are hints — not fully-formed messages. Message construction is the responsibility of the payment orchestration layer (Layer 2 of the Financial Autonomy Stack).

**Hint fields:**

| Field | ISO 20022 Mapping |
|---|---|
| `message_type` | Identifies target message family (pacs.008, pain.001, etc.) |
| `service_level` | `SvcLvl/Cd` |
| `local_instrument` | `LclInstrm/Cd` |
| `charge_bearer` | `ChrgBr` |

### 8.2 Supported Message Families

| Message | Use Case |
|---|---|
| `pacs.008` | FI-to-FI customer credit transfer (FedNow, SWIFT) |
| `pain.001` | Customer credit transfer initiation (ACH) |
| `pacs.002` | Payment status report |
| `camt.053` | Bank-to-customer statement |
| `camt.054` | Bank-to-customer notification |

### 8.3 End-to-End Traceability

Every FAS-1 resolution event emits a `resolution_id` (UUID) that maps to the `EndToEndId` field in the downstream ISO 20022 message. This enables full audit trail from alias resolution through settlement.

---

## 9. AI Agent Compatibility (AP2 / A2A / MCP / x402)

FAS-1 is designed as native infrastructure for the machine economy. Aliases are the primary addressing primitive for AI agent payments.

### 9.1 Agent Resolution Flow

```
AI Agent
  │
  ├─ Resolves: pay:vendor.alpha
  │
  ├─ Receives: ResolutionResponse with endpoints + iso20022_hint
  │
  ├─ Selects: preferred_rail (fednow | xrpl | ach | swift)
  │
  └─ Executes: payment via Layer 3 router (not FAS-1's responsibility)
```

### 9.2 MCP Tool Surface (Roadmap)

A FAS-1 MCP server will expose the following tools to AI agents, allowing any MCP-compatible agent to resolve payment addresses natively within their tool call loop:

```
resolve_alias(alias: str) → ResolutionResponse
check_availability(alias: str) → AvailabilityStatus
list_endpoints(alias: str) → List[PaymentEndpoint]
```

### 9.3 x402 Payment Header Integration (Roadmap)

FAS-1 aliases will be accepted as the `X-Payment-Destination` header in the x402 payment-required protocol. When a server returns `402 Payment Required` with a `pay:` alias, a compatible agent resolves the alias and completes the payment autonomously.

---

## 10. Security Considerations

### 10.1 Payment Verification

The registry MUST verify XRPL payment TX hashes on-chain before committing any registration. The API MUST NOT trust client-provided amount claims. Amount is read directly from the validated ledger transaction.

### 10.2 Founding Cap Atomicity

The 500-name founding cap MUST be enforced with a `SELECT ... FOR UPDATE` inside the same transaction as the INSERT. Cap check and INSERT in separate transactions create a race condition that would allow cap overflow.

### 10.3 Wallet Uniqueness

The one-name-per-wallet constraint is enforced via a partial unique index:

```sql
CREATE UNIQUE INDEX uq_founding_wallet
  ON aliases (founding_xrpl_address)
  WHERE tier = 'founding';
```

This is a database-level constraint, not application-level. Application checks are a first-pass guard only.

### 10.4 OFAC / Sanctions Screening

Resolution requests MUST be screened against OFAC sanctions lists. A positive hit returns `COMPLIANCE_BLOCKED` (403). Screening results are cached for a maximum of 24 hours. Fresh screening is required after 24h.

### 10.5 Travel Rule

Payments routed through FAS-1-resolved endpoints that exceed jurisdictional thresholds (typically USD 3,000 domestic, USD 1,000 international) MUST include Travel Rule data. The `iso20022_hint` field includes `travel_rule_required: true` when the resolved entity's jurisdiction triggers this requirement.

### 10.6 Content Policy

The FAS-1 registry enforces a content policy at alias registration time. Aliases containing racial slurs, slurs targeting protected characteristics, hate-speech terms, or their leet-speak obfuscation variants are rejected before any database write with `ALIAS_BLOCKED` (422).

The content policy is implemented via a two-tier matching strategy:

**Tier 1 — Substring matching:** Long or unambiguous terms are checked against the full de-obfuscated alias slug. This catches leet-speak variants (`n1gg3r` → normalised to `nigger`), hyphen-insertion obfuscation, and embedded occurrences (`pay:vendor.anigger`).

**Tier 2 — Segment matching:** Short or ambiguous terms are checked only against individual dot-separated segments to prevent false positives. `pay:user.nig` → blocked. `pay:vendor.nigerian` → not blocked.

The normalisation pipeline strips hyphens, substitutes common digit-to-letter leet mappings (0→o, 1→i, 3→e, 4→a, etc.), and folds to lowercase before comparison.

The enumerated blocked-term list is not published as part of this open specification. Its existence is disclosed; its contents are not, to prevent enumeration and systematic evasion. The reference implementation source is available in `app/schemas/validators/blocked_terms.py`.

Errors from the content policy MUST NOT echo the matched term back to the caller. The error message MUST be a generic policy statement.

---

## 11. Spec Versioning

| Version | Status | Notes |
|---|---|---|
| v0.1 | Implemented | Core alias format, registration, resolution, XRPL memo anchor |
| v0.2 | Active | Full 41-anchor namespace inventory, `ALIAS_BLOCKED` content policy, validation evaluation order, `FAS-1-NS` namespace anchor memo schema |
| v1.0 | Planned | Stable release, NFT identity anchoring, sub-namespace delegation, MCP tool surface |

Breaking changes to the URI syntax, resolution response schema, or XRPL memo schema require a version increment. Additive optional fields are non-breaking.

---

## 12. Reference Implementation

The FAS-1 reference implementation is the Financial Autonomy Stack, available at:

- **Public spec:** https://github.com/dnsofmoney/dns-of-money (MIT)
- **Public protocol core:** https://github.com/dnsofmoney/a2a-protocol-core (Apache 2.0)

Key implementation modules:

| Module | Path | Purpose |
|---|---|---|
| Alias validator | `app/schemas/validators/alias.py` | FAS-1 format + reserved + content checks |
| Content policy | `app/schemas/validators/blocked_terms.py` | Two-tier blocked-term matching |
| Memo writer | `app/services/fas1_memo.py` | XRPL memo TX builder and submitter |
| Namespace check | `scripts/check_namespace_anchors.py` | Mainnet anchor inventory scan |
| Resolver | `app/services/resolver.py` | pay: → ResolutionResponse |

Runtime: Python 3.11+, FastAPI, PostgreSQL 15+, SQLAlchemy 2, Redis 7, EC2 with Nginx. XRPL mainnet (production anchors) and XRPL testnet (development).

---

## Appendix A: Complete Namespace Registry

All 41 names registered on XRPL mainnet. All are immutable and timestamped on-chain.

### A.1 FAS-1-NS Root Wildcards

```
pay:bank.*
pay:agent.*
pay:platform.*
pay:vendor.*
pay:user.*
pay:contract.*
```

### A.2 Reserved Premium

```
pay:ai          pay:api         pay:contractor  pay:corp
pay:dao         pay:dev         pay:dns         pay:edu
pay:enterprise  pay:fas         pay:freelance   pay:gov
pay:llm         pay:treasury    pay:wallet
```

### A.3 Reserved Defensive

```
pay:bis           pay:cbdc          pay:chaps
pay:chips         pay:cips          pay:correspondent
pay:fednow        pay:fedreserve    pay:fedwire
pay:imf           pay:iso20022      pay:nostro
pay:odl           pay:ripplenet     pay:swift
pay:swift.eur     pay:swift.usd     pay:target2
pay:vostro        pay:worldbank
```

### A.4 Additional Protected Single-Labels

```
pay:pay   pay:money   pay:cash    pay:send    pay:receive
pay:transfer   pay:root   pay:admin   pay:system   pay:test   pay:null
```

---

## Appendix B: FAS-1 Regex

```python
import re
import unicodedata

FAS1_PATTERN = re.compile(
    r'^pay:[a-z0-9][a-z0-9\-]*(\.[a-z0-9][a-z0-9\-]*)+$'
)
MAX_LENGTH = 128

def is_valid_fas1(alias: str) -> bool:
    """Normalise then validate. Returns True if the alias is syntactically valid."""
    v = unicodedata.normalize("NFKC", alias).lower().strip()
    if len(v) > MAX_LENGTH:
        return False
    if ".." in v:
        return False
    return bool(FAS1_PATTERN.match(v))
```

Note: `is_valid_fas1()` checks syntax only. A syntactically valid alias may still be `ALIAS_RESERVED` or `ALIAS_BLOCKED`. Full validation requires the complete pipeline in §4.6.

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
    "alias": { "type": "string", "pattern": "^pay:" },
    "resolved": { "type": "boolean" },
    "entity": {
      "type": "object",
      "properties": {
        "display_name": { "type": "string" },
        "entity_type": {
          "type": "string",
          "enum": ["vendor","agent","bank","platform","user","contract","enterprise","dev","ai","dao"]
        },
        "tier": { "type": "string", "enum": ["founding","standard","enterprise"] }
      }
    },
    "endpoints": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rail", "priority"],
        "properties": {
          "rail": { "type": "string", "enum": ["ach","fednow","swift","xrpl","solana","card"] },
          "priority": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "iso20022_hint": { "type": "object" },
    "compliance": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["clear","pending","blocked"] },
        "travel_rule_required": { "type": "boolean" }
      }
    },
    "ttl_seconds": { "type": "integer", "minimum": 0 },
    "resolved_at": { "type": "string", "format": "date-time" }
  }
}
```

---

## Appendix D: XRPL Namespace Anchor Memo Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://spec.dnsofmoney.com/fas-1/namespace-anchor-memo.json",
  "title": "FAS-1-NS Namespace Anchor Memo",
  "type": "object",
  "required": ["type", "name", "category", "owner", "anchored_at"],
  "properties": {
    "type":        { "type": "string", "const": "FAS-1-NS" },
    "name":        { "type": "string", "pattern": "^pay:" },
    "category":    { "type": "string", "enum": ["wildcard","premium","defensive"] },
    "owner":       { "type": "string" },
    "anchored_at": { "type": "string", "format": "date-time" }
  }
}
```

---

*FAS-1 v0.2 Active — DNS of Money Project — Financial orchestration infrastructure for the machine economy. We are not a bank. We are the layer above it.*
