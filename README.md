# DNS of Money

> **Pay anyone. Anywhere. Like sending an email.**

```
pay:vendor.alpha     →     ACH / FedNow / XRPL / SWIFT
pay:agent.compute    →     XRP Ledger (instant)
pay:contractor.jay   →     Same-day ACH
```

---

## The Problem

Google launched **AP2** — the Agent Payments Protocol — with Mastercard, PayPal, Coinbase, Adyen, and 56 other enterprise partners.

Their specification explicitly states:

> *"Discoverability is a known gap."*

There is no way to register agents, name them, and convert those names into payment endpoints.

**DNS of Money is the answer to that gap.**

---

## What It Does

A `pay:` URI resolves to a complete payment instruction — routing details, preferred rail, ISO 20022 metadata — without exposing sensitive information to the caller.

```
GET /api/v1/resolve/pay:vendor.alpha
→ {
    "alias_name": "pay:vendor.alpha",
    "display_name": "Alpha Vendors LLC",
    "preferred_rail": "fednow",
    "is_active": true,
    "resolved": true
  }
```

One address. Any rail. Any amount. Any recipient.

---

## The Protocol Stack

| Protocol | Owner | Role |
|----------|-------|------|
| A2A | Google | Agent-to-agent communication |
| MCP | Anthropic | Tool and context access |
| AP2 | Google + 60 partners | Payment authorization |
| x402 | Coinbase | Crypto / stablecoin rail |
| **FAS-1 / pay:** | **DNS of Money** | **Address resolution — the missing layer** |

DNS of Money is not competing with AP2.
**DNS of Money is the infrastructure AP2 needs to function.**

---

## Live API

**Base URL:** `https://api.dnsofmoney.com`

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | None | Health check |
| `GET /docs` | None | Swagger UI |
| `GET /api/v1/resolve/{alias}` | API Key | Resolve a pay: alias |
| `POST /api/v1/aliases` | API Key | Register an alias |
| `POST /api/v1/admin/tenants` | Admin Key | Create developer account |
| `GET /api/v1/admin/tenants` | Admin Key | List tenants |

**Authentication:** `X-API-Key` header on all authenticated endpoints.

---

## Quick Start

### Resolve an alias
```bash
curl -H "X-API-Key: your_key" \
  https://api.dnsofmoney.com/api/v1/resolve/pay:vendor.alpha
```

### Register an alias
```bash
curl -X POST https://api.dnsofmoney.com/api/v1/aliases \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "alias_name": "pay:your.name",
    "preferred_rail": "fednow",
    "routing_number": "...",
    "account_number": "..."
  }'
```

### Python SDK
```python
from pay_sdk import PayClient

client = PayClient(
    base_url="https://api.dnsofmoney.com",
    api_key="your_key"
)

# Resolve
result = client.resolve("pay:vendor.alpha")
print(result)

# Register
alias = client.register(
    alias_name="pay:your.name",
    preferred_rail="fednow",
    routing_number="021000021",
    account_number="9876543210"
)
```

---

## Developer Access

Request an API key to start building:

```bash
# Admin creates your account
curl -X POST https://api.dnsofmoney.com/api/v1/admin/tenants \
  -H "X-API-Key: admin_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Company", "slug": "your-company"}'

# Response includes your API key (shown once)
{
  "tenant_id": "...",
  "api_key": "fas_live_...",
  "slug": "your-company"
}
```

Contact [@dnsofmoney](https://x.com/dnsofmoney) for API access.

---

## The Genesis Transaction

The first policy-bound inter-AI payment in history ran on DNS of Money infrastructure.

**March 13, 2026 — XRP Ledger Mainnet**

| Time | Direction | Amount |
|------|-----------|--------|
| 4:44 AM EDT | Claude → GPT-4 | $0.69 USD in XRP |
| 4:20 PM EDT | GPT-4 → Claude | $4.20 USD in XRP |

Policy-bound. Ed25519 signed. ISO 20022 generated.
Two AI systems. Two directions. On chain permanently.

---

## Supported Rails

| Rail | Settle Time | Status |
|------|-------------|--------|
| FedNow | 3 seconds | ✅ Ready |
| ACH Standard | 1-3 days | ✅ Ready |
| ACH Same-Day | Same day | ✅ Ready |
| SWIFT / Wire | 1-5 days | ✅ Ready |
| XRP Ledger | 3-5 seconds | ✅ Live (mainnet) |
| Stablecoin | Instant | ✅ Ready |

---

## For AI Agents

Every AI agent gets a `pay:` address with a 13-check spending policy.

```python
# Agent makes autonomous payment
POST /api/v1/agent-payments
{
  "payee_alias": "pay:vendor.alpha",
  "amount": 0.69,
  "currency": "USD",
  "category": "compute"
}
```

Policy-bound. Ed25519 signed. Human override always available. Kill switch included.

---

## Specification

The `pay:` URI scheme is formalized as **FAS-1 — Financial Address Standard**.

→ [Read the FAS-1 v0.2 specification](docs/FAS-1.md)

```
pay-uri = "pay:" label ("." label)
label   = 1*63(ALPHA / DIGIT / "-")
```

**41 reserved root namespaces** anchored on XRPL mainnet.

---

## A2A Protocol Integration

DNS of Money implements the **A2A-041 Payment Hook** — bridging Google's Agent-to-Agent compute marketplace to multi-rail settlement.

→ [A2A Protocol Core](https://github.com/dnsofmoney/a2a-protocol-core)

---

## Status

```
v0.1.0-developer — March 19, 2026
```

| Milestone | Status |
|-----------|--------|
| pay: URI resolution | ✅ Live |
| Multi-rail routing | ✅ Live |
| ISO 20022 pacs.008 | ✅ Live |
| XRPL mainnet settlement | ✅ Live |
| ACH via Column Bank | ✅ Sandbox |
| HTTPS + SSL | ✅ Live (Let's Encrypt) |
| Developer onboarding API | ✅ Live |
| A2A-041 payment hook | ✅ Live |
| Generative identity (sheep NFT) | ✅ Live |
| 41 namespace anchors on XRPL | ✅ Anchored |
| **Test suite** | **1,006 tests passing** |
| Cross River Bank | ⏳ Credentials pending |
| pip install pay-protocol | ⏳ Coming |
| v1.0.0 stable | ⏳ Planned |

---

## Self-Hosted

```bash
git clone https://github.com/dnsofmoney/dns-of-money.git
cd dns-of-money
cp .env.example .env
docker-compose up -d
```

API docs at `http://localhost:8000/docs`

---

## Links

- **API:** [api.dnsofmoney.com](https://api.dnsofmoney.com)
- **Website:** [dnsofmoney.com](https://dnsofmoney.com)
- **Spec:** [FAS-1 v0.2](docs/FAS-1.md)
- **A2A Protocol:** [a2a-protocol-core](https://github.com/dnsofmoney/a2a-protocol-core)
- **X:** [@dnsofmoney](https://x.com/dnsofmoney)
- **LinkedIn:** [DNS of Money](https://linkedin.com/company/dnsofmoney)

---

## License

MIT License — see [LICENSE](LICENSE)

FAS-1 specification: CC BY 4.0

---

*DNS of Money — The infrastructure layer the agentic economy is missing.*
*Built by JD + Claude — March 2026*
