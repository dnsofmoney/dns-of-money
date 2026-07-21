# Changelog

All notable changes to `@dnsofmoney/a2a-protocol-core` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/). Version
numbers track the Python `a2a-protocol-core` reference — 0.3.0 here is feature
parity with Python 0.3.0 (the 0.2.0/0.2.1 pay-path features are folded in,
since TS skipped those releases).

## [0.3.0] — 2026-07-20

TS parity with Python 0.3.0: the SDK can buy and verify the product end to
end — pay DNS of Money's USDC-priced endpoints, screen a counterparty before
paying it, and cryptographically verify the attestation you paid for. Also
folds in the Python 0.2.0/0.2.1 XRP pay-path (TS never shipped a 0.2.x).

### Added
- `payAliasXrp(...)` — pay a `pay:` alias in XRP from the caller's own wallet:
  resolve the x402 402 challenge, sign + submit locally (optional `xrpl` peer
  dependency — the seed never leaves the process), settle, and receive the
  signed resolve/verify/OFAC-screen attestation. Reads `invoiceId`/`sourceTag`
  from the requirement's `extra` block per the XRPL exact scheme (deprecated
  top-level fallback), so it is conformant with servers that drop the mirrors
  after 2026-10-01.
- `payAliasUsdcAlgorand(...)` — pay a `pay:` alias in USDC on Algorand from
  the caller's own wallet. Signs the USDC transfer leg locally via the
  OFFICIAL x402 client mechanisms (optional peer deps `@x402/core` +
  `@x402/avm` + `algosdk`); the facilitator co-signs the fee leg and submits.
  Omit the amount to pay the alias's declared (enforced) price.
- `payAlias(...)` — rail-dispatching front door: `currency: "XRP"` → XRPL,
  `"USDC"` → Algorand. Deterministic table lookup, no scoring.
- `screen(...)` / `screenWithPaymentHeader(...)` / `ScreenResult` — client for
  the paid counterparty screen (`GET /x402/screen/{target}`): pay the
  server-priced fee, receive the OFAC + resolution attestation about a
  caller-named `pay:` alias or raw any-chain address. "Screen before you pay,"
  one call.
- `verifyAttestation(...)` — client-side verification of the signed
  attestation's `eddsa-jcs-2022` Data Integrity proof: resolves the issuer's
  `did:web` document, enforces `assertionMethod` authorization, verifies the
  Ed25519 signature. JCS, base58btc, did:web resolution, AND the Ed25519 check
  are all dependency-free (`node:crypto`) — no install needed, unlike the
  Python `[verify]` extra. An unsigned attestation FAILS verification by
  design.
- `attestSettledPayment(...)` — bring-your-own already-settled XRPL tx hash
  and get the read-only verify + attestation. No wallet dependency needed.
- `fetchRequirement(...)` / `fetchRequirementHeader(...)` — decoded and raw
  `PAYMENT-REQUIRED` challenge fetch (raw is what official x402 client
  decoders consume).
- Bounded retry with exponential backoff on every idempotent HTTP leg
  (challenge fetch, settle, capabilities, DID-document fetch): network
  errors/timeouts and 502/503/504 only, fixed attempt count, no jitter.
  Settle legs are retry-safe because the server checks idempotency before
  verification. The payment-hook POST is never auto-retried — re-send with
  the same `jobId` + `semanticHash` (the server's idempotency key) instead.
- Bring-your-own wallet seams: `signAndSubmit` (XRPL) and
  `buildPaymentHeader` (Algorand) options let agents with their own wallet
  stacks replace the default signers.

### Changed
- `A2APaymentHookClient` now throws a typed `A2AClientError` (with
  `statusCode` and a `body` snippet) instead of a bare `Error`, so agents can
  branch on the failure. `capabilities()` retries transient failures.
- All signing dependencies are OPTIONAL `peerDependencies` — the base install
  stays zero-dependency; core resolve/hash/attest/verify paths work without
  any of them.

## [0.1.0] — 2026-07-11

Initial TypeScript port of the Python `a2a-protocol-core` 0.1.0: `pay:` URI
addressing (FAS-1 grammar), A2A-009 semantic normalizer, A2A-008 canonical
hashing (byte-identical to Python, proven by a shared cross-language vector
file), A2A-041 wire schemas, and the payment-hook client. Published to npm.
