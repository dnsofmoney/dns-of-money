# DNS of Money — Examples

Quickstart — resolve a `pay:` alias in one line:

```bash
curl -s https://api.dnsofmoney.com/v1/resolve/pay:vendor.alpha | python3 -m json.tool
```

## Examples

### Python

| File | Description |
|------|-------------|
| [`python/resolve.py`](python/resolve.py) | Resolve a `pay:` alias to payment endpoints. Handles 404, reads entity info, endpoints, and ISO 20022 hints. |
| [`python/register.py`](python/register.py) | Register a new `pay:` alias. Checks availability first, handles 409 (taken) and 422 (invalid format). |

```bash
# Resolve (no auth required for basic resolution)
python examples/python/resolve.py

# Register (requires API key)
API_KEY=fas_live_... python examples/python/register.py
```

Requirements: `pip install requests`

### TypeScript

| File | Description |
|------|-------------|
| [`typescript/resolve.ts`](typescript/resolve.ts) | Resolve a `pay:` alias using `fetch()`. Includes full TypeScript types for the resolution response. |

```bash
npx tsx examples/typescript/resolve.ts
```

No external dependencies — uses built-in `fetch()`.

### curl

| File | Description |
|------|-------------|
| [`curl/resolve.sh`](curl/resolve.sh) | One-liner to resolve `pay:vendor.alpha` |
| [`curl/register.sh`](curl/register.sh) | Register a new alias (requires API key) |
| [`curl/agent_card.sh`](curl/agent_card.sh) | Fetch the AP2/A2A-003 agent capability manifest |

## JSON Schemas

Machine-readable schemas for request/response validation:

| Schema | Description |
|--------|-------------|
| [`schemas/resolution-response.json`](../schemas/resolution-response.json) | Full `ResolutionResponse` schema (draft-07) |
| [`schemas/alias-registration.json`](../schemas/alias-registration.json) | Alias registration request body |
| [`schemas/agent-card.json`](../schemas/agent-card.json) | AP2/A2A-003 agent card |

## Specification

Full protocol spec: [`docs/FAS-1-spec.md`](../docs/FAS-1-spec.md)

## Base URL

All examples use `https://api.dnsofmoney.com` as the base URL.

Authentication: `X-API-Key` header. Required for write operations (register, update). Optional for read operations (resolve, availability check) — unauthenticated requests receive tier-0 (public) responses with some fields redacted.
