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

Zero runtime dependencies (native `fetch` + `node:crypto`).

## What's in here

| Export | A2A ref | Purpose |
|---|---|---|
| `isValidPayUri` | FAS-1 | `pay:` URI grammar + validation |
| `normalizeMessage` / `normalizeAction` | A2A-009 | collapse synonym verbs → canonical action codes |
| `computeCanonicalHash` | A2A-008 | metadata- & vocabulary-stable payment-intent hash |
| `validatePaymentHookRequest` + types | A2A-041 | payment-hook request/response wire models |
| `A2APaymentHookClient` | A2A-041 | client over `/v1/a2a/*` |

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

## Develop

```bash
npm install
npm run build   # tsc -> dist/
npm test        # compiles + runs the cross-language vector conformance tests
```

## License

Apache-2.0 — permissive with an explicit patent grant. See [LICENSE](LICENSE).
