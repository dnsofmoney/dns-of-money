# Integration Guide

Get started resolving and minting `pay:` aliases.

## Quick Links

- [Resolve a pay: alias](#resolve-a-pay-alias) (for developers integrating resolution)
- [Mint a founding name](#mint-a-founding-name) (for users who want a pay: name)
- [API reference](#response-fields-tier-3)
- [SDKs](#sdks)

---

## Mint a Founding Name

The founding tier is live. 600 total names. Once gone, the tier closes permanently.

### Graduated Pricing

| Mints | Price | Slots |
|-------|-------|-------|
| 1-10 | Free (1 drop) | 10 (claimed) |
| 11-79 | 1 XRP | ~50 |
| 80-129 | 2 XRP | 50 |
| 130-179 | 3 XRP | 50 |
| 180-229 | 4 XRP | 50 |
| 230-600 | 5 XRP | 371 |

Price increases automatically as each tier fills. Check the current price:

```bash
curl https://api.dnsofmoney.com/api/v1/founding/status
```

Returns `price_xrp`, `slots_at_price`, and `tier_label`.

### How to Mint

1. **Go to [dnsofmoney.com](https://dnsofmoney.com)** and click "Mint your name"
2. **Choose your name** — type it in and check availability
3. **Connect your Xaman (XUMM) wallet** — scan the QR or tap the deeplink on mobile
4. **Sign the payment** — the current XRP price is shown. One tap in Xaman.
5. **Wait for your identity** — the pipeline generates a unique fractal flame, uploads it to IPFS, and mints an XLS-20 NFT on XRPL mainnet
6. **Claim your NFT** — scan the claim QR to accept the NFT into your wallet

### Rules

- One name per XRPL wallet
- Single-label names allowed (e.g., `pay:yourname`)
- Founding names are permanently grandfathered at founding tier pricing
- Each name gets a generative NFT identity that evolves with usage
- On-chain proof via FAS-1 memo transaction on XRPL

### Check Current Status

```bash
curl https://api.dnsofmoney.com/api/v1/founding/status
```

```json
{
  "success": true,
  "data": {
    "total": 600,
    "claimed": 31,
    "remaining": 569,
    "price_xrp": "1",
    "tier_label": "1 XRP (48 left at this price)",
    "slots_at_price": 48
  }
}
```

### Check Availability

```bash
curl https://api.dnsofmoney.com/api/v1/founding/available/pay:yourname
```

---

## Base URL

```
https://api.dnsofmoney.com
```

## Authentication

Pass your API key via the `X-API-Key` header. Resolution works without a key (tier 0) but returns redacted fields. Higher tiers unlock more data.

| Tier | Access | Fields |
|------|--------|--------|
| 0 | No key | alias, status, resolution_id, message_id |
| 1 | Read key | + entity, endpoints (redacted routing) |
| 2 | Standard key | + full routing metadata, compliance |
| 3 | Admin key | + identity block, rail_score, cache_hit |

## Resolve a pay: alias

```
GET /resolve/pay:{name}
```

### curl

```bash
# Tier 0 (no key)
curl https://api.dnsofmoney.com/resolve/pay:architect

# Tier 3 (full access)
curl -H "X-API-Key: fas_live_..." \
  https://api.dnsofmoney.com/resolve/pay:architect
```

### Python

```python
from dnsofmoney import DNSOfMoneyClient

client = DNSOfMoneyClient(api_key="fas_live_...")
result = client.resolve("pay:architect")

# Payment endpoint
ep = result.endpoints[0]
print(ep.rail)                         # "xrpl"
print(ep.routing_metadata["xrpl_address"])  # "r3VG..."

# Identity (tier 3)
print(result.identity.image_url)       # IPFS gateway URL
print(result.identity.nft_token_id)    # XLS-20 NFT ID
print(result.identity.generation)      # genome generation

# Compliance
print(result.compliance.result)        # "LOW"
print(result.compliance.screened)      # True

# ISO 20022 hint
print(result.iso20022_hint["message_family"])  # "pacs.008"
```

### TypeScript

```typescript
import { DNSOfMoneyClient } from "dnsofmoney";

const client = new DNSOfMoneyClient({ apiKey: "fas_live_..." });
const result = await client.resolve("pay:architect");

// Payment endpoint
const ep = result.endpoints[0];
console.log(ep.rail);                          // "xrpl"
console.log(ep.routingMetadata.xrplAddress);   // "r3VG..."

// Identity (tier 3)
console.log(result.identity?.imageUrl);
console.log(result.identity?.nftTokenId);
```

## Response envelope

All responses are wrapped:

```json
{
  "success": true,
  "data": { ... },
  "error_code": null,
  "message": null,
  "timestamp": "2026-03-24T21:59:44Z"
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error_code": "ALIAS_NOT_FOUND",
  "message": "No alias registered for pay:nonexistent",
  "timestamp": "2026-03-24T21:59:44Z"
}
```

## Response fields (tier 3)

### Resolution metadata

| Field | Type | Description |
|-------|------|-------------|
| `resolution_id` | UUID | Unique resolution event ID. Maps to EndToEndId in ISO 20022. |
| `message_id` | string | FAS-1 message identifier |
| `alias` | string | The resolved `pay:` alias |
| `status` | string | `resolved`, `partial`, or `failed` |
| `resolved_at` | ISO 8601 | When resolution was performed |
| `cache_hit` | boolean | Whether served from cache |
| `caller_tier` | int | 0-3, your auth tier |

### Endpoints

Ranked payment endpoints. Ordered by priority (1 = highest).

| Field | Type | Description |
|-------|------|-------------|
| `rail_type` | string | `xrpl`, `ach`, `fednow`, `swift` |
| `currency` | string | ISO 4217 code (`XRP`, `USD`) |
| `priority` | int | 1 = most preferred |
| `routing_metadata` | object | Rail-specific routing details |
| `settlement_latency` | string | `3-5s`, `instant`, `1-3 days` |
| `fee_estimate` | string | Estimated fee |

### Identity block

Present at tier 3 for aliases with minted NFT identities.

| Field | Type | Description |
|-------|------|-------------|
| `nft_token_id` | string | XLS-20 NFT token ID on XRPL mainnet |
| `image_uri` | string | `ipfs://` URI for the generative identity image |
| `metadata_uri` | string | `ipfs://` URI for NFT metadata JSON |
| `image_url` | string | HTTPS gateway URL for the image |
| `nft_explorer_url` | string | XRPL explorer link for the NFT |
| `generation` | int | Genome generation (increases with evolution) |
| `identity_status` | string | `pending`, `complete`, `render_failed`, etc. |
| `tier` | string | `founding`, `standard`, `enterprise` |

### Compliance

| Field | Type | Description |
|-------|------|-------------|
| `screened` | boolean | Whether OFAC/sanctions screening was performed |
| `result` | string | `LOW`, `MEDIUM`, `HIGH`, `BLOCKED` |
| `provider` | string | Screening provider |
| `screened_at` | ISO 8601 | When screening was last performed |

### ISO 20022 hint

Downstream message construction hints for the preferred rail.

| Field | Type | Description |
|-------|------|-------------|
| `message_family` | string | `pacs.008`, `pain.001` |
| `service_level` | string | ISO 20022 SvcLvl/Cd |
| `travel_rule_required` | boolean | Whether Travel Rule applies |

### Rail score

Deterministic scoring breakdown for each available rail.

```json
{
  "xrpl": {
    "score": 116,
    "breakdown": {
      "priority": 1,
      "xrpl_rail": 90,
      "fx_corridor": 25
    }
  }
}
```

## Check availability

```
GET /api/v1/aliases/check/{name}
```

```bash
curl https://api.dnsofmoney.com/api/v1/aliases/check/pay:desired.name
```

```python
available = client.check_availability("pay:desired.name")
```

## Register an alias

```
POST /api/v1/aliases
```

Requires an API key. See the [FAS-1 spec](FAS-1-spec.md) for registration requirements.

## Error codes

| Code | HTTP | Description |
|------|------|-------------|
| `ALIAS_NOT_FOUND` | 404 | Alias does not exist |
| `ALIAS_INACTIVE` | 404 | Alias exists but is deactivated |
| `COMPLIANCE_BLOCKED` | 403 | Alias blocked by sanctions screening |
| `COMPLIANCE_PENDING` | 202 | Screening in progress, retry later |
| `INVALID_ALIAS_FORMAT` | 400 | Alias doesn't match FAS-1 format |
| `RATE_LIMITED` | 429 | Too many requests |
| `CAP_EXCEEDED` | 409 | Founding tier cap reached |
| `WALLET_ALREADY_REGISTERED` | 409 | Wallet already has a founding name |
| `TX_HASH_ALREADY_USED` | 409 | Payment TX already used for another registration |
| `ALIAS_UNAVAILABLE` | 409 | Name is taken or reserved |

## SDKs

- [Python SDK](../sdk/python/) — zero dependencies, standard library only
- [TypeScript SDK](../sdk/typescript/) — zero dependencies, native fetch

## Links

- [FAS-1 specification](FAS-1-spec.md)
- [JSON schemas](../schemas/)
- [Examples](../examples/)
- [CHANGELOG](../CHANGELOG.md)
