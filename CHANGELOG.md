# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

## [0.2.0] — 2026-03-21

### Added

- FAS-1 specification v0.2 with founding tier, compliance signals, and AP2 integration sections
- AP2 compatibility layer — `agent_commerce` block on all resolution responses
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

[Unreleased]: https://github.com/dnsofmoney/dns-of-money/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/dnsofmoney/dns-of-money/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dnsofmoney/dns-of-money/releases/tag/v0.1.0
