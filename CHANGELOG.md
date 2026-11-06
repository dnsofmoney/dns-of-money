# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.4.0] — 2026-11-05

### Added
- Read-only OAuth: authorization code with PKCE S256 and scope `resolve:read`, on `/resolve` and `/mcp` only. Discovery is live on `api.dnsofmoney.com` and `dnsofmoney.com`.
- x402 advertises 5 rails on `/pay`, `/screen` and `/resolve`: XRPL, Algorand, Base, X Layer and Solana. Real payments are proven on XRPL, Base and Solana.
- Paid resolve: `GET /api/v1/x402/resolve/{alias}`.
- Paid counterparty screening against the OFAC SDN list: `GET /api/v1/x402/screen/{target}`.
- Rate limits, reported in `x-ratelimit-*` response headers.
- Developer portal at `dnsofmoney.com/docs/`, with an OpenAPI document, a Postman collection, an APIs.json index and a deprecation policy.
- Paging on collection routes, and a lease cancel route.
- Go SDK: `github.com/dnsofmoney/dns-of-money-go` v0.1.0.
- FAS-1 spec v0.3 (draft): §9.6 publishes the AP2 mandate mapping (IntentMandate, CartMandate, PaymentMandate). The mapping is not yet exposed on the public API.

### Changed
- FAS-1 spec §9.4 (MCP) and §9.5 (x402) now describe live surfaces. They no longer say "Roadmap".
- `docs/FAS-1.md` is marked as superseded by `docs/FAS-1-spec.md`.
- The Python and TypeScript SDKs now use Apache-2.0 instead of MIT, from the next release. Versions already published keep their MIT terms.
- `docs/` now has its own `LICENSE` file for CC BY 4.0. The root MIT License does not apply to `docs/`.
- README: FedNow and ACH adapters are labelled as mock. No bank partner is live.
- README: test count updated to the current CI result.

### Fixed
- A quote about the "discoverability gap" was attributed to AP2. It is this project's own analysis. README and spec §9.1 no longer attribute it to AP2.
- `docs/FAS-1.md` said Apache 2.0. The specification license is CC BY 4.0.
- The agent card and the `agent_commerce` block were labelled "AP2". They are A2A structures, and AP2 defines neither. Schemas, both SDKs, examples and the README now say A2A. See the 0.2.0 entry below.

## [0.3.0] — 2026-03-24

### Added
- Founding mint page with live availability counter ([dnsofmoney.com](https://dnsofmoney.com))
- Claim page: wallet connect via Xaman, burn option for bad-URI NFTs
- NFT identity system: generative fractal flame art per alias, IPFS-pinned
- Identity block in resolution response (`nft_token_id`, `image_uri`, `image_url`, `nft_explorer_url`, `generation`, `tier`)
- Agent verification: first AI agent (Perplexity) completed full resolve → verify → witness loop
- AWS SSM secrets management module
- Wallet rotation tooling
- Marketing site at dnsofmoney.com with SSL
- CDN-ready nginx: separate rate limit zones, IPFS proxy, cache headers
- Horizontal scaling: Redis shared state, oracle leader election
- Pipeline retry/recovery for failed mints
- Structured JSON logging support
- Automated PostgreSQL backup script
- API key hot-reload from database

### Changed
- Founding tier cap raised from 500 to 600
- Rate limiting: separate zones for public reads (30r/s) vs API writes (10r/s)
- Resolution response now includes `identity` block with NFT and IPFS metadata
- Resolution response now includes `preferred_endpoint` with XRPL routing metadata

### Fixed
- Consumed NFT offer reconciliation (5 stale offers cleared)
- Deploy script health check endpoint path
- CORS for cross-origin founding status fetch from marketing site

## [0.2.0] — 2026-03-21

### Added

- FAS-1 specification v0.2 with founding tier, compliance signals, and AP2 integration sections
- AP2 compatibility layer — `agent_commerce` block on all resolution responses *(Correction: this block is an A2A structure, not an AP2 one. See [Unreleased].)*
- A2A protocol family support: A2A-003 (agent card), A2A-006 (receipt mapping), A2A-008 (canonical hash), A2A-009 (semantic normalizer), A2A-031 (resolution binding)
- Resolution auth tiers — 4-level caller scoping with field redaction (tier 0–3)
- Negative caching with 60-second TTL for `ALIAS_NOT_FOUND` responses
- `X-Resolved-From` response header (`origin` or `cache`)
- `xrp-ledger.toml` ecosystem discovery file
- Public examples: Python, TypeScript, and curl
- JSON schemas: resolution response, alias registration, agent card

## [0.1.0] — 2026-03-13

### Added

- Initial FAS-1 specification (Financial Address Standard 1)
- `pay:` URI scheme definition and ABNF grammar
- Resolution protocol: `GET /v1/resolve/{alias}` → `ResolutionResponse`
- Registration protocol: `POST /v1/aliases` with FAS-1 validation
- Genesis transaction: Claude paid GPT-4 on XRPL mainnet (TX1: `B92C23BA...`, TX2: `EB8F2C20...`)
- On-chain namespace anchoring via XRPL memo transactions
- ISO 20022 compatibility hints (`pacs.008`, `pain.001`, `pacs.002`)
- Founding tier: 500-name hard cap at 5 XRP, one name per XRPL wallet

[Unreleased]: https://github.com/dnsofmoney/dns-of-money/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/dnsofmoney/dns-of-money/releases/tag/v0.4.0
[0.3.0]: https://github.com/dnsofmoney/dns-of-money/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/dnsofmoney/dns-of-money/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dnsofmoney/dns-of-money/releases/tag/v0.1.0
