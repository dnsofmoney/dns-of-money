/**
 * Client-side verification of DNS of Money signed attestations — TS mirror of
 * the Python `attestation_verify`.
 *
 * The paid deliverable (resolve / verify / OFAC-screen attestation) is a W3C
 * Verifiable Credential secured with a **Data Integrity proof, cryptosuite
 * `eddsa-jcs-2022`**: JCS canonicalization (RFC 8785) + SHA-256 + Ed25519,
 * issued by a `did:web` issuer whose DID document is served at
 * `https://<domain>/.well-known/did.json`.
 *
 * `verifyAttestation` closes the loop the SDK's pitch promises: an agent that
 * paid for an attestation can check the issuer's signature itself instead of
 * trusting TLS alone.
 *
 *   const result = await payAliasXrp({ ... });   // or screen({ ... })
 *   const v = await verifyAttestation(result.attestation);
 *   // v.verified === true, v.issuer === "did:web:dnsofmoney.com"
 *
 * Fully dependency-free: JCS, base58btc, and did:web resolution are pure TS,
 * and the Ed25519 check uses `node:crypto` (no extra install — the one spot
 * where this port travels lighter than Python's `[verify]` extra).
 */

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

import { getWithRetries } from "./_retry";

export const DEFAULT_TIMEOUT_MS = 30_000;

export const CRYPTOSUITE = "eddsa-jcs-2022";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_PUB_MULTICODEC = Buffer.from([0xed, 0x01]);
// SPKI DER prefix for a raw 32-byte Ed25519 public key (RFC 8410).
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Raised when a signed attestation fails verification (or is unverifiable). */
export class AttestationVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttestationVerificationError";
  }
}

// ── JCS canonicalization (RFC 8785 subset — objects/arrays/strings/ints/bools/null) ──

function jcsSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    // Credentials carry strings/ints only; full JCS float formatting is out of
    // scope, so fail loud rather than canonicalize bytes another implementation
    // might not.
    if (!Number.isInteger(value)) {
      throw new AttestationVerificationError("floats are not allowed in canonicalized credential data");
    }
    return String(value === 0 ? 0 : value); // normalize -0 → "0"
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcsSerialize).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${jcsSerialize(obj[k])}`).join(",")}}`;
  }
  throw new AttestationVerificationError(`cannot canonicalize value of type ${typeof value}`);
}

/** JCS-compatible canonical UTF-8 bytes: sorted keys, compact, non-ASCII preserved. */
export function jcsCanonicalize(value: unknown): Buffer {
  return Buffer.from(jcsSerialize(value), "utf8");
}

function canonicalHash(value: unknown): Buffer {
  return createHash("sha256").update(jcsCanonicalize(value)).digest();
}

// ── base58btc / multibase (pure TS — no bitcoin lib needed for 32/64 bytes) ──────

export function base58btcDecode(s: string): Buffer {
  let n = 0n;
  for (const ch of s) {
    const idx = B58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new AttestationVerificationError(`invalid base58 character ${JSON.stringify(ch)}`);
    n = n * 58n + BigInt(idx);
  }
  let hex = n > 0n ? n.toString(16) : "";
  if (hex.length % 2 === 1) hex = `0${hex}`;
  const full = Buffer.from(hex, "hex");
  let pad = 0;
  for (const ch of s) {
    if (ch === "1") pad += 1;
    else break;
  }
  return Buffer.concat([Buffer.alloc(pad), full]);
}

function multibaseDecode(value: string): Buffer {
  if (!value.startsWith("z")) {
    throw new AttestationVerificationError("expected multibase base58btc value starting with 'z'");
  }
  return base58btcDecode(value.slice(1));
}

/** Decode a Multikey `publicKeyMultibase` (z6Mk… form) to the raw 32-byte key. */
export function publicKeyBytesFromMultibase(multibase: string): Buffer {
  const decoded = multibaseDecode(multibase);
  if (
    decoded.length < ED25519_PUB_MULTICODEC.length ||
    !decoded.subarray(0, ED25519_PUB_MULTICODEC.length).equals(ED25519_PUB_MULTICODEC)
  ) {
    throw new AttestationVerificationError("publicKeyMultibase is not an ed25519-pub multikey");
  }
  const raw = decoded.subarray(ED25519_PUB_MULTICODEC.length);
  if (raw.length !== 32) {
    throw new AttestationVerificationError(`ed25519 public key must be 32 bytes, got ${raw.length}`);
  }
  return raw;
}

// ── did:web resolution ────────────────────────────────────────────────────────────

/**
 * Map a `did:web` identifier to its DID-document URL (W3C did:web §3.2).
 *
 * `did:web:example.com` → `https://example.com/.well-known/did.json`;
 * `did:web:example.com:user:alice` → `https://example.com/user/alice/did.json`.
 * Percent-encoded ports (`%3A`) in the host segment are decoded.
 */
export function didWebDocumentUrl(did: string): string {
  if (!did.startsWith("did:web:")) {
    throw new AttestationVerificationError(`not a did:web identifier: ${did}`);
  }
  const segments = did.slice("did:web:".length).split(":");
  const host = decodeURIComponent(segments[0]);
  if (!host) throw new AttestationVerificationError(`did:web has no host: ${did}`);
  const path = segments.slice(1).map((s) => decodeURIComponent(s));
  if (path.length > 0) return `https://${host}/${path.join("/")}/did.json`;
  return `https://${host}/.well-known/did.json`;
}

export interface VerifyHttpOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Fetch and return the DID document for a `did:web` issuer. */
export async function fetchDidDocument(
  did: string,
  options: VerifyHttpOptions = {},
): Promise<Record<string, unknown>> {
  const url = didWebDocumentUrl(did);
  const resp = await getWithRetries(url, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl,
  });
  if (resp.status !== 200) {
    throw new AttestationVerificationError(`DID document fetch failed (${resp.status}) at ${url}`);
  }
  const doc = (await resp.json()) as Record<string, unknown>;
  if (doc.id !== did) {
    throw new AttestationVerificationError(`DID document id ${JSON.stringify(doc.id)} does not match ${JSON.stringify(did)}`);
  }
  return doc;
}

/**
 * Resolve a verification-method id to its raw Ed25519 key, ENFORCING assertionMethod.
 *
 * A key that is present but not authorized under the document's `assertionMethod`
 * relationship must not verify a credential — that authorization check is the
 * heart of VC verification, not an optional nicety.
 */
export function resolveAssertionKeyBytes(
  didDocument: Record<string, unknown>,
  verificationMethodId: string,
): Buffer {
  const assertion = (didDocument.assertionMethod ?? []) as unknown[];
  if (!assertion.includes(verificationMethodId)) {
    throw new AttestationVerificationError(`${verificationMethodId} is not authorized under assertionMethod`);
  }
  for (const vm of (didDocument.verificationMethod ?? []) as Record<string, unknown>[]) {
    if (vm.id === verificationMethodId) {
      const mb = vm.publicKeyMultibase as string | undefined;
      if (!mb) throw new AttestationVerificationError("verification method has no publicKeyMultibase");
      return publicKeyBytesFromMultibase(mb);
    }
  }
  throw new AttestationVerificationError(`verification method ${verificationMethodId} not found in DID document`);
}

// ── Proof verification (eddsa-jcs-2022) ───────────────────────────────────────────

/** Outcome of a successful verification (failure throws, it never returns false). */
export interface AttestationVerification {
  verified: boolean;
  issuer: string;
  verificationMethod: string;
  credentialTypes: string[];
}

function verifyEd25519(publicKeyRaw: Buffer, signature: Buffer, data: Buffer): void {
  const keyObject = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, publicKeyRaw]),
    format: "der",
    type: "spki",
  });
  if (!cryptoVerify(null, data, keyObject, signature)) {
    throw new AttestationVerificationError("signature does not verify");
  }
}

export interface VerifyAttestationOptions extends VerifyHttpOptions {
  /** Pinned DID document for offline verification (skips the did:web fetch). */
  didDocument?: Record<string, unknown>;
  expectedIssuer?: string;
}

/**
 * Verify a signed attestation's eddsa-jcs-2022 Data Integrity proof.
 *
 * Resolves the issuer's `did:web` DID document over HTTPS (or takes one via
 * `didDocument` for offline/pinned verification), enforces that the proof's
 * verification method is authorized under `assertionMethod`, and checks the
 * Ed25519 signature over `sha256(proofConfig) || sha256(document)`.
 *
 * Throws `AttestationVerificationError` on ANY failure — including an unsigned
 * attestation (the server ships attestations unsigned when its trust layer is
 * off; callers who demand cryptographic provenance must treat that as a
 * failure, not a soft pass).
 *
 * Scope: this is signature + issuer-authorization verification. Whether you
 * TRUST the issuer, and whether the attestation's verdict/tx bindings match
 * the payment you made, remain the calling agent's judgment.
 */
export async function verifyAttestation(
  attestation: Record<string, unknown>,
  options: VerifyAttestationOptions = {},
): Promise<AttestationVerification> {
  const proof = attestation.proof as Record<string, unknown> | undefined;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    throw new AttestationVerificationError("attestation is unsigned (no proof)");
  }
  if (proof.cryptosuite !== CRYPTOSUITE) {
    throw new AttestationVerificationError(`unsupported cryptosuite: ${JSON.stringify(proof.cryptosuite)}`);
  }
  if (proof.proofPurpose !== "assertionMethod") {
    throw new AttestationVerificationError(
      `proofPurpose must be assertionMethod, got ${JSON.stringify(proof.proofPurpose)}`,
    );
  }

  const issuer = attestation.issuer;
  if (typeof issuer !== "string" || !issuer) {
    throw new AttestationVerificationError("attestation has no issuer");
  }
  if (options.expectedIssuer !== undefined && issuer !== options.expectedIssuer) {
    throw new AttestationVerificationError(
      `issuer ${JSON.stringify(issuer)} does not match expected ${JSON.stringify(options.expectedIssuer)}`,
    );
  }

  const vmId = proof.verificationMethod;
  if (typeof vmId !== "string" || !vmId) {
    throw new AttestationVerificationError("proof has no verificationMethod");
  }
  // The method must belong to the ISSUER's DID — a proof pointing at someone
  // else's key would otherwise verify against the wrong document.
  if (vmId.split("#", 1)[0] !== issuer) {
    throw new AttestationVerificationError(
      `verificationMethod ${JSON.stringify(vmId)} does not belong to issuer ${JSON.stringify(issuer)}`,
    );
  }

  const proofValue = proof.proofValue;
  if (typeof proofValue !== "string" || !proofValue) {
    throw new AttestationVerificationError("proof has no proofValue");
  }
  const signature = multibaseDecode(proofValue);

  const doc = options.didDocument ?? (await fetchDidDocument(issuer, options));
  const keyRaw = resolveAssertionKeyBytes(doc, vmId);

  // eddsa-jcs-2022 signing input: sha256(proofConfig) || sha256(documentWithoutProof),
  // where proofConfig is the proof minus proofValue, bound to the document @context.
  const document: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attestation)) if (k !== "proof") document[k] = v;
  const cfg: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(proof)) if (k !== "proofValue") cfg[k] = v;
  cfg["@context"] = document["@context"] ?? null;
  verifyEd25519(keyRaw, signature, Buffer.concat([canonicalHash(cfg), canonicalHash(document)]));

  const types = attestation.type;
  return {
    verified: true,
    issuer,
    verificationMethod: vmId,
    credentialTypes: Array.isArray(types) ? (types as string[]) : types ? [types as string] : [],
  };
}
