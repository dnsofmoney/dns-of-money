# @dnsofmoney/a2a-protocol-core

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

The open, **deterministic** protocol core of the [DNS of Money](https://dnsofmoney.com)
agent-to-agent (A2A) payment surface — the TypeScript twin of the Python
[`a2a-protocol-core`](https://pypi.org/project/a2a-protocol-core/). The
dependency-light layer external AI agents adopt to resolve, hash, and initiate
`pay:` payments.

> The intelligence lives in the **calling agent**. This package serves
> deterministic, inspectable primitives — no rail selection, no scoring, no
> model anywhere in the money path.

## Install

```bash
npm install @dnsofmoney/a2a-protocol-core
```

Zero runtime dependencies (native `fetch` + `node:crypto`). The wallet-signing
pay paths lazy-load OPTIONAL peer dependencies — install only the rail you pay on:

```bash
npm install xrpl                          # payAliasXrp — sign XRP locally
npm install @x402/core @x402/avm algosdk  # payAliasUsdcAlgorand / screen fee — official x402 AVM client
```

`verifyAttestation` needs nothing extra — Ed25519 verification runs on
`node:crypto` (the one spot where this port travels lighter than the Python
package's `[verify]` extra).

## What's in here

| Export | A2A ref | Purpose |
|---|---|---|
| `isValidPayUri` | FAS-1 | `pay:` URI grammar + validation |
| `normalizeMessage` / `normalizeAction` | A2A-009 | collapse synonym verbs → canonical action codes |
| `computeCanonicalHash` | A2A-008 | metadata- & vocabulary-stable payment-intent hash |
| `validatePaymentHookRequest` + types | A2A-041 | payment-hook request/response wire models |
| `A2APaymentHookClient` | A2A-041 | client over `/v1/a2a/*`, typed `A2AClientError` |
| `payAlias` / `payAliasXrp` / `payAliasUsdcAlgorand` | x402 | one-call non-custodial pay from YOUR wallet |
| `attestSettledPayment` | x402 | bring-your-own settled tx → read-only verify + attestation |
| `screen` / `screenWithPaymentHeader` | x402 | paid counterparty screen — "screen before you pay" |
| `verifyAttestation` | eddsa-jcs-2022 | check the attestation's Data Integrity proof yourself |

## Byte-identical to Python

Canonical and semantic hashes here are **byte-for-byte identical** to the Python
`a2a-protocol-core`. Two agents — one in Python, one in TypeScript — describing
the same payment produce the **same** `computeCanonicalHash`. This is enforced by
a shared cross-language vector file ([`test/vectors/canonical_vectors.json`](test/vectors/canonical_vectors.json),
generated from the Python reference) that both test suites assert against.

The subtlety: the hash is `SHA256(json.dumps(fields, sort_keys=True))` using
Python's default separators (`", "` / `": "`) and `ensure_ascii=True`. A naive
`JSON.stringify` would produce different bytes — so this package ships a faithful
serializer (`src/_pyjson.ts`). **Pass amounts as strings** to stay in the
proven-identical zone (a JSON float like `2.0` can't round-trip through a JS
number).

## Quick start

```ts
import {
  A2APaymentHookClient,
  computeCanonicalHash,
  normalizeMessage,
} from "@dnsofmoney/a2a-protocol-core";

// Same intent, different wording ("send" == "transfer" == "pay") => same hash.
const intent = { action: "send", amount: "2.50", currency: "USD", alias: "pay:agent.compute" };
const semanticHash = computeCanonicalHash(normalizeMessage(intent));

const client = new A2APaymentHookClient("https://api.dnsofmoney.com");
const res = await client.trigger({
  jobId: "job-001",
  providerPayAddress: "pay:agent.compute",
  requesterPayAddress: "pay:vendor.alpha",
  amount: "2.50",
  currency: "USD",
  semanticHash,
});
console.log(res.settlement_result.status, res.iso_message_ref);
```

## Pay a `pay:` alias from your own wallet (x402)

Non-custodial by construction: keys sign locally, in *your* process, and are
never transmitted. DNS of Money read-only-verifies the settled payment and
returns the signed resolve/verify/OFAC-screen attestation.

```ts
import { payAlias, verifyAttestation } from "@dnsofmoney/a2a-protocol-core";

// XRP on XRPL (needs the optional `xrpl` peer dep):
const xrp = await payAlias({
  baseUrl: "https://api.dnsofmoney.com",
  alias: "pay:vendor.alpha",
  amount: "0.10",
  currency: "XRP",
  xrplSeed: process.env.XRPL_SEED!,   // signs locally, never sent
  apiKey: process.env.FAS_API_KEY!,   // attributes the settle leg
});

// USDC on Algorand (official x402 AVM client — omit `amount` to pay the
// alias's declared, server-enforced price):
const usdc = await payAlias({
  baseUrl: "https://api.dnsofmoney.com",
  alias: "pay:dnsofmoney",
  currency: "USDC",
  algorandMnemonic: process.env.ALGORAND_MNEMONIC!,
  apiKey: process.env.FAS_API_KEY!,
});

// Don't trust TLS alone — check the attestation's Ed25519 proof yourself:
const v = await verifyAttestation(usdc.attestation);
console.log(v.verified, v.issuer, usdc.summary.verdict);
```

Already settled through your own wallet stack? `attestSettledPayment({ txHash, ... })`
skips the signing and just fetches the read-only verify + attestation.

## Screen before you pay

```ts
import { screen } from "@dnsofmoney/a2a-protocol-core";

const result = await screen({
  baseUrl: "https://api.dnsofmoney.com",
  target: "pay:vendor.alpha",           // or a raw any-chain address
  apiKey: process.env.FAS_API_KEY!,
  algorandMnemonic: process.env.ALGORAND_MNEMONIC!, // fee is USDC on Algorand
  verify: true,                          // also check the attestation signature
});
if (result.verdict === "CLEAR") {
  // proceed to pay the vendor
}
```

The screened party is decoupled from the paid party: you pay DNS of Money's
declared fee and receive an OFAC + resolution attestation about the target you
named. Agents with their own wallet stacks can drop in via the
`buildPaymentHeader` (Algorand) / `signAndSubmit` (XRPL) seams, or use
`screenWithPaymentHeader` directly.

## Develop

```bash
npm install
npm run build   # tsc -> dist/
npm test        # compiles + runs the cross-language vector conformance tests
```

## License

Apache-2.0 — permissive with an explicit patent grant. See [LICENSE](LICENSE).
