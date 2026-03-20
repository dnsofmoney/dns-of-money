# dns://money — Financial Address Resolution for the Machine Economy

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FAS-1 Spec](https://img.shields.io/badge/spec-FAS--1%20v0.2-green)](docs/FAS-1-spec.md)
[![XRPL Anchored](https://img.shields.io/badge/XRPL-anchored%20on--chain-blue)](https://xrpl.org)
[![Status](https://img.shields.io/badge/status-Phase%206%20active-orange)](CHANGELOG.md)
[![A2A Compatible](https://img.shields.io/badge/A2A-041%20compatible-purple)](https://github.com/dnsofmoney/a2a-protocol-core)

> **We are not a bank. We are the layer above it.**

DNS of Money is a **financial address resolution protocol** and **payment orchestration infrastructure** for the machine economy. It resolves human-readable `pay:` identifiers to payment endpoints across multiple rails — without touching funds, holding deposits, or requiring a banking license.

---

## What This Is

Just as DNS resolves `example.com` → `IP address`, FAS-1 resolves `pay:vendor.alpha` → **complete payment instruction**.

```
pay:agent.compute  →  { rail: "XRPL", address: "rXXX...", iso_hint: "pacs.008.001.08" }
pay:vendor.alpha   →  { rail: "FedNow", address: "021000021:1234567890", fee_estimate: "0.045" }
pay:contractor.jay →  { rail: "ACH", routing: "...", account: "..." }
```

No raw wallet addresses. No routing numbers in UX. One identifier that works everywhere.

---

## Why This Exists

**The agent address resolution gap.** AI agents can now transact autonomously — but there is no standard way to name them, register them, and convert those names into payment endpoints. AP2, A2A, and MCP all have this gap. FAS-1 is the answer.

> *"Discoverability is a known gap. There is no way to register agents, name them, and convert those names into payment endpoints."*
> — FAS-1 v0.2, AP2 gap analysis

DNS of Money is the naming and resolution layer for agentic commerce.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DNS of Money                              │
│                  pay: Namespace Layer                        │
│                                                             │
│   pay:agent.compute  →  Resolver  →  ResolutionResponse     │
│                              │                              │
│         ┌────────────────────┼────────────────────┐         │
│         ▼                    ▼                    ▼         │
│    XRPL Adapter         FedNow Adapter       ACH Adapter    │
│    (XRPL mainnet)       (instant USD)        (Column)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
          ┌───────────────────────────────────────┐
          │         Financial Autonomy Stack       │
          │           (execution layer)            │
          │  Payment routing · ISO 20022 · OFAC   │
          │  Agent wallets · Policy engine         │
          └───────────────────────────────────────┘
```

### Four-Layer Stack

| Layer | Name | Purpose |
|---|---|---|
| 1 | **DNS of Money** | `pay:` alias registration and resolution |
| 2 | **AI Orchestration Layer** | Routing decisions, cost optimization, rail scoring |
| 3 | **Multi-Rail Payment Router** | Settlement execution (ACH, FedNow, XRPL, SWIFT) |
| 4 | **Autonomous Agent Network** | M2M commerce, agent-to-agent payment hooks |

MVP flow: `alias → resolve → route → ISO 20022 hint → simulate settlement`

---

## The `pay:` URI Scheme

**FAS-1** (Financial Address Standard 1) defines the `pay:` URI scheme for human-readable financial addresses.

```
pay:vendor.alpha          # vendor namespace, alpha entity
pay:agent.compute         # agent namespace, compute service
pay:contractor.jay        # contractor namespace, individual
pay:bank.settlement       # institutional namespace
```

### Format

```
pay-uri  = "pay:" label *("." label)
label    = 1*63( ALPHA / DIGIT / "-" )
```

Rules:
- Lowercase only
- Dots are hierarchy separators, not name separators
- People and brands: `firstlast` (no dots) — e.g., `pay:elonmusk`
- Max 128 characters
- Regex: `^pay:[a-z0-9][a-z0-9\-]*(\.[a-z0-9][a-z0-9\-]*)+$`

Full spec: [`docs/FAS-1-spec.md`](docs/FAS-1-spec.md) · License: CC BY 4.0

---

## Resolution Response

```json
{
  "alias": "pay:vendor.alpha",
  "preferred_rail": "XRPL",
  "endpoints": [
    {
      "rail": "XRPL",
      "currency": "USD",
      "address": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "routing_metadata": { "destination_tag": 12345 },
      "settlement_latency": "3-5s",
      "fee_estimate": "0.0001"
    },
    {
      "rail": "FedNow",
      "currency": "USD",
      "address": "021000021:1234567890",
      "routing_metadata": { "routing_number": "021000021" },
      "settlement_latency": "instant",
      "fee_estimate": "0.045"
    }
  ],
  "iso20022_hint": "pacs.008.001.08",
  "ttl_seconds": 300,
  "resolved_at": "2026-03-20T00:00:00Z"
}
```

---

## Quick Start

### Resolve a `pay:` alias

```bash
curl https://api.dnsofmoney.com/v1/resolve/pay:vendor.alpha \
  -H "X-API-Key: your_key"
```

### Register a `pay:` alias (founding tier)

```bash
curl -X POST https://api.dnsofmoney.com/v1/aliases/register \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "pay:yourname.here",
    "xrpl_address": "rYourXRPLAddress",
    "payment_tx_hash": "VERIFIED_5XRP_TX_HASH",
    "tier": "founding"
  }'
```

### Check availability

```bash
curl https://api.dnsofmoney.com/v1/aliases/available/yourname.here
# → { "status": "available" | "taken" | "reserved" }
```

---

## Agent Integration

### MCP / A2A

DNS of Money resolves the agent payment discoverability gap identified in AP2 and A2A-002. Any agent can advertise a `pay:` alias; any caller can resolve it to a ranked list of payment endpoints without prior knowledge of the agent's banking infrastructure.

```python
# A2A-031 binding pattern
agent_card = {
    "agent_id": "AGT-COMPUTE-001",
    "payment_alias": "pay:agent.compute"
}

# Caller resolves before payment
resolution = await resolve("pay:agent.compute")
# → { rail, address, iso20022_hint }
```

### Python

```python
import httpx

async def resolve_payment_alias(alias: str, api_key: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.dnsofmoney.com/v1/resolve/{alias}",
            headers={"X-API-Key": api_key}
        )
        return r.json()

result = await resolve_payment_alias("pay:vendor.alpha", "your_key")
print(result["preferred_rail"])   # "XRPL"
print(result["iso20022_hint"])    # "pacs.008.001.08"
```

### JavaScript / TypeScript

```typescript
const resolve = async (alias: string): Promise<ResolutionResponse> => {
  const res = await fetch(`https://api.dnsofmoney.com/v1/resolve/${alias}`, {
    headers: { "X-API-Key": process.env.DNS_MONEY_API_KEY! }
  });
  return res.json();
};

const { preferred_rail, endpoints, iso20022_hint } = await resolve("pay:agent.compute");
```

---

## Supported Payment Rails

| Rail | Type | Latency | Currency |
|---|---|---|---|
| XRPL | Blockchain | 3–5 seconds | XRP, IOUs |
| FedNow | Instant ACH | Instant | USD |
| ACH | Bank transfer | 1–3 days | USD |
| SWIFT | Wire | 1–5 days | Multi-currency |
| Solana/USDC | Blockchain | <1 second | USDC |

---

## On-Chain Namespace Anchors

All root namespaces are immutably anchored on XRPL mainnet via FAS-1 memo transactions before publication of this spec. This is the moat: namespaces cannot be forked once registered on-chain.

**Confirmed on-chain (March 2026):**

```
Genesis TX        — March 13, 2026 — first inter-AI payment on XRPL mainnet
pay:agent.*       — March 17, 2026 — agent namespace root
pay:swift         pay:fednow        pay:fedreserve
pay:iso20022      pay:cbdc          pay:treasury
pay:bis           pay:imf           pay:worldbank
pay:correspondent pay:nostro        pay:vostro
pay:fedwire       pay:chips         pay:chaps
pay:target2       pay:cips          pay:ripplenet
pay:odl           pay:swift.usd     pay:swift.eur
```

All memo transactions use the FAS-1 format:
```json
{
  "p": "FAS-1",
  "v": "0.1",
  "a": "pay:agent.*",
  "t": "root_namespace",
  "o": "dnsofmoney.com",
  "d": "2026-03-17"
}
```

---

## Founding Tier

The first **500** `pay:` names are available at **5 XRP** flat — permanently grandfathered at founding pricing. One name per XRPL wallet. On-chain proof issued at registration.

- Founding tier encoded on XRPL mainnet via FAS-1 memo
- Permanent — cannot be revoked
- Hard cap enforced atomically: `SELECT ... FOR UPDATE` inside the registration transaction

**Check remaining spots:** `GET /v1/aliases/founding/remaining`

---

## Proof of Work

This is not vaporware. The transactions below are real. The XRPL ones are publicly verifiable by anyone — no login, no trust required.

### XRPL Mainnet — Publicly Verifiable On-Chain

| TX | Time (UTC) | Direction | Amount | Ledger | Hash |
|---|---|---|---|---|---|
| TX1 | 08:44 Mar 13 2026 | Claude → GPT-4 | $0.69 in XRP | 102837427 | [`B92C23BA...`](https://livenet.xrpl.org/transactions/B92C23BADE5864569F82BB65B60F84D3B6A8C59A75FC1E75B3DF2A5121A4DA77) |
| TX2 | 20:20 Mar 13 2026 | GPT-4 → Claude | $4.20 in XRP | 102849264 | [`EB8F2C20...`](https://livenet.xrpl.org/transactions/EB8F2C203D021B10018A2A1E857DA07EC29DBB127741D5320E30291B3D9EB197) |

Click either hash. It's on the ledger. Permanent.

### Column ACH — Traditional Banking Rail Confirmed

| TX | Time (UTC) | Description | Transaction ID | Status |
|---|---|---|---|---|
| TX3 | 09:45 Mar 15 2026 | Claude → GPT-4 compute services | `acht_3AybmiRrSDNCmOtONX1yfPjiYUw` | Settled |

Column ACH operates on a private banking rail — no public explorer. The transaction ID is the canonical record. This confirms the traditional rails work alongside the blockchain rails.

Bidirectional AI payment rail: proven. First inter-AI payments on XRPL mainnet and ACH. On-chain where possible, verifiable where not.

---

## ISO 20022 Compatibility

All payment models are ISO 20022 compatible. The resolver returns `iso20022_hint` on every resolution response, enabling downstream systems to generate standards-compliant payment messages without any mapping work.

| Message | Usage |
|---|---|
| `pacs.008` | Credit transfer initiation |
| `pacs.002` | Payment status report |
| `pain.001` | Customer credit transfer |
| `camt.053` | Account statement |
| `camt.054` | Debit/credit notification |

---

## What We Are Not

This protocol is explicit about scope:

```
✅ Payment address resolution
✅ Payment orchestration infrastructure
✅ Financial metadata layer
✅ Routing intelligence layer
✅ API gateway over licensed banking infrastructure

❌ Not a bank
❌ Not a deposit holder
❌ Not a settlement institution
❌ Not a card issuer
❌ Not a clearing network
```

No banking license required to use this protocol.

---

## Repository Structure

```
dns-of-money/
├── docs/
│   ├── FAS-1-spec.md          # Financial Address Standard 1 (CC BY 4.0)
│   ├── architecture.md        # Full system architecture
│   └── integration-guide.md   # Integration patterns (MCP, A2A, REST)
├── examples/
│   ├── python/                # Python integration examples
│   ├── typescript/            # TypeScript/JavaScript examples
│   └── curl/                  # REST API examples
├── schemas/
│   ├── resolution-response.json   # JSON Schema for resolution response
│   └── registration-request.json  # JSON Schema for registration
└── CHANGELOG.md
```

---

## Related Repositories

| Repo | Purpose | License |
|---|---|---|
| [`dnsofmoney/dns-of-money`](https://github.com/dnsofmoney/dns-of-money) | FAS-1 spec, integration docs, schemas (this repo) | MIT |
| [`dnsofmoney/a2a-protocol-core`](https://github.com/dnsofmoney/a2a-protocol-core) | A2A protocol core — agent-to-agent commerce | Apache 2.0 |

---

## API Reference

Base URL: `https://api.dnsofmoney.com`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/resolve/{alias}` | Resolve a `pay:` alias to payment endpoints |
| `GET` | `/v1/aliases/available/{name}` | Check alias availability |
| `POST` | `/v1/aliases/register` | Register a new `pay:` alias |
| `GET` | `/v1/aliases/founding/remaining` | Founding tier spots remaining |
| `GET` | `/health` | API health check |

Full API docs: [api.dnsofmoney.com/docs](https://api.dnsofmoney.com/docs)

Authentication: `X-API-Key` header required for all write operations.

---

## Current State vs. Roadmap

### Live Today ✅
- `pay:` alias registration and resolution (6-stage pipeline)
- XRPL payment rail (mainnet, proven)
- ACH integration (sandbox)
- OFAC sanctions screening
- ISO 20022 hint generation
- Founding tier (500-name hard cap, on-chain proof)
- 41 root namespaces anchored on XRPL mainnet
- EC2 deployment, HTTPS live (`api.dnsofmoney.com`)
- 999 tests passing

### Roadmap 🗺️
- FedNow production integration (pending banking partner)
- SDK packages (Python, TypeScript, Go)
- LangChain / CrewAI / AutoGPT integration modules
- Subdomain delegation (hierarchical namespace tree)
- Resolution fee pricing
- Token economics and governance

---

## FAS-1 Spec

The Financial Address Standard 1 (FAS-1) is the open protocol specification underlying `pay:` URIs. It is licensed under CC BY 4.0 — free to implement, extend, and build on.

Key properties:
- Rail-agnostic: one alias resolves to N endpoints, ordered by policy
- ISO 20022 aligned: every resolution carries a message family hint
- On-chain anchored: namespace ownership is verifiable on XRPL mainnet
- AP2/A2A/MCP compatible: designed for agentic commerce from day one

Read the spec: [`docs/FAS-1-spec.md`](docs/FAS-1-spec.md)

---

## Contributing

This repo is the public home of the FAS-1 specification and integration documentation. We welcome:

- Issues: spec clarifications, edge cases, implementation questions
- PRs: integration examples, documentation improvements, schema refinements
- Discussions: use cases, protocol extensions, competing approaches

For protocol-level proposals, open an issue with the `[RFC]` prefix.

---

## License

- Protocol specification (`docs/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Code examples and schemas: [MIT](LICENSE)

---

## Community

- **Reddit:** [r/DNSofMoney](https://www.reddit.com/r/DNSofMoney/)
- **Twitter/X:** [@dnsofmoney](https://twitter.com/dnsofmoney)
- **Website:** [dnsofmoney.com](https://dnsofmoney.com)

---

<p align="center">
  <strong>Financial orchestration infrastructure for the machine economy.</strong><br>
  Payments. AI agents. Autonomous commerce.<br>
  <em>We are not a bank. We are the layer above it.</em>
</p>
