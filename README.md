# DNS of Money

> **Pay anyone. Anywhere. Like sending an email.**
pay:vendor.alpha     →     ACH / FedNow / XRPL / SWIFT
pay:agent.compute    →     XRP Ledger (instant)
pay:contractor.jay   →     Same-day ACH

---

## The Problem

Google launched **AP2** — the Agent Payments Protocol — with Mastercard, PayPal, Coinbase, Adyen, and 56 other enterprise partners.

Their specification explicitly states:

> *"Discoverability is a known gap. There is no way to register agents, name them, and convert those names into payment endpoints."*

**DNS of Money is the answer to that gap.**

---

## What It Does

A `pay:` URI resolves to a complete payment instruction — routing number, account details, preferred rail, ISO 20022 metadata — without exposing sensitive information to the caller.
GET /resolve/pay:vendor.alpha
→ {
"alias": "pay:vendor.alpha",
"entity": "Alpha Vendor Corp",
"preferred_rail": "fednow",
"endpoints": [
{ "rail": "fednow",  "settle": "3s",  "fee_bps": 5  },
{ "rail": "ach",     "settle": "24h", "fee_bps": 1  },
{ "rail": "xrpl",    "settle": "4s",  "fee_bps": 0  }
]
}

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

## How It Works
AI Agent / App / Human
↓
pay:vendor.alpha          ← human-readable address
↓
DNS of Money Resolver     ← FAS-1 resolution
↓
Payment Orchestration     ← routing decision
↓
Rail Selection            ← ACH / FedNow / XRPL / SWIFT
↓
Settlement                ← real money moves

---

## The Genesis Transaction

The first policy-bound inter-AI payment in history
ran on Project O infrastructure.

**March 13, 2026 — XRP Ledger Mainnet**
4:44 AM EDT   Claude → GPT-4   $0.69 USD in XRP
TX: B92C23BADE5864569F82BB65B60F84D3B6A8C59A75FC1E75B3DF2A5121A4DA77
4:20 PM EDT   GPT-4 → Claude   $4.20 USD in XRP
TX: EB8F2C203D021B10018A2A1E857DA07EC29DBB127741D5320E30291B3D9EB197

On-chain memo:
> *"Transcending transactions, we've woven trust into the
> digital fabric. Minds and money converge in coded harmony."*

Policy-bound. Ed25519 signed. ISO 20022 generated.
Two AI systems. Two directions. Both 4:20. On chain permanently.

---

## Specification

The `pay:` URI scheme is formalized as **FAS-1 — Financial Address Standard**.

[Read the FAS-1 specification →](docs/FAS-1.md)
pay-uri = "pay:" label ("." label)
label   = 163(ALPHA / DIGIT / "-")

Reserved root namespaces:

| Namespace | Purpose |
|-----------|---------|
| `pay:vendor.*` | Commercial entities |
| `pay:agent.*` | Autonomous AI agents |
| `pay:bank.*` | Financial institutions |
| `pay:platform.*` | Payment platforms |
| `pay:user.*` | Individual users |
| `pay:contract.*` | Smart contracts |

---

## Quick Start
```bash
# Resolve an alias
curl https://api.dnsofmoney.com/resolve/pay:vendor.alpha \
  -H "X-API-Key: your_key"

# Register an alias
curl -X POST https://api.dnsofmoney.com/api/v1/aliases \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "alias_name": "pay:your.name",
    "preferred_rail": "fednow",
    "routing_number": "...",
    "account_number": "..."
  }'

# Send a payment
curl -X POST https://api.dnsofmoney.com/payments \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "creditor_alias": "pay:vendor.alpha",
    "amount": 125.00,
    "currency": "USD"
  }'
```

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

## Supported Rails

| Rail | Settle Time | Status |
|------|-------------|--------|
| FedNow | 3 seconds | ✅ Ready |
| ACH Standard | 1-3 days | ✅ Ready |
| ACH Same-Day | Same day | ✅ Ready |
| SWIFT / Wire | 1-5 days | ✅ Ready |
| XRP Ledger | 3-5 seconds | ✅ Live |
| Stablecoin | Instant | ✅ Ready |

---

## For AI Agents

Every AI agent gets a `pay:` address.
```python
# Register an agent
POST /api/v1/agents
{
  "agent_name": "pay:agent.compute",
  "agent_type": "COMPUTE"
}

# Agent makes autonomous payment
POST /api/v1/agent-payments
{
  "payee_alias": "pay:vendor.alpha",
  "amount": 0.69,
  "currency": "USD",
  "category": "compute"
}
```

Policy-bound. Ed25519 signed. 13-check spending policy.
Human override always available. Kill switch included.

---

## AP2 Compatibility

DNS of Money resolves to AP2-compatible agent cards:
```json
{
  "agent_card": {
    "name": "pay:vendor.alpha",
    "entity_type": "business"
  },
  "payment_methods": [
    { "type": "BANK_PUSH_RTP",    "rail": "fednow" },
    { "type": "BANK_PUSH_ACH",    "rail": "ach"    },
    { "type": "CRYPTO_PUSH_XRPL", "rail": "xrpl"  }
  ]
}
```

Compatible with AP2, A2A, MCP, x402.

---

## Status
v0.1.0-alpha — March 15, 2026
✅ pay: URI resolution live
✅ Multi-rail payment routing
✅ ISO 20022 pacs.008 generation
✅ XRP Ledger mainnet settlement
✅ ACH via Column Bank
✅ System 4 autonomous agent payments
✅ 202 tests passing
⏳ Cross River Bank — credentials pending
⏳ SDK — pip install pay-protocol
⏳ v0.1.0-mvp — first real fiat customer

---

## Links

- **Website:** [dnsofmoney.com](https://dnsofmoney.com)
- **Spec:** [FAS-1 — Financial Address Standard](docs/FAS-1.md)
- **X:** [@dnsofmoney](https://x.com/dnsofmoney)
- **LinkedIn:** [DNS of Money](https://linkedin.com/company/dnsofmoney)

---

## License

MIT License — see [LICENSE](LICENSE)

FAS-1 specification: CC BY 4.0

---

*DNS of Money — The infrastructure layer the agentic economy is missing.*
*Built by JD + Claude Sonnet 4.6 — March 2026*
