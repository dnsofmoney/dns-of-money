# Integration Guide

Get started resolving `pay:` aliases in your application.

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

## SDKs

- [Python SDK](../sdk/python/) — zero dependencies, standard library only
- [TypeScript SDK](../sdk/typescript/) — zero dependencies, native fetch

## Links

- [FAS-1 specification](FAS-1-spec.md)
- [JSON schemas](../schemas/)
- [Examples](../examples/)
- [CHANGELOG](../CHANGELOG.md)
