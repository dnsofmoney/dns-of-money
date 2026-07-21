/**
 * Shared test scaffolding: a scripted fake `fetch` (the injection seam every
 * network-touching function exposes) and an eddsa-jcs-2022 credential factory
 * mirroring the server's signer, built on node:crypto.
 */

import { KeyObject, createHash, generateKeyPairSync, sign as cryptoSign } from "node:crypto";

import { jcsCanonicalize } from "../src/attestationVerify";

// ── Scripted fetch ───────────────────────────────────────────────────────────────

export interface RecordedCall {
  url: string;
  init?: RequestInit;
}

export interface FakeFetch {
  impl: typeof fetch;
  calls: RecordedCall[];
}

/**
 * A fetch that replays the given script in order: a Response is resolved, an
 * Error is rejected. Extra calls throw (over-calling is a test bug). Response
 * FACTORIES (functions) are also accepted so a single script entry can build a
 * fresh Response per call.
 */
export function makeFetch(...script: (Response | Error | (() => Response))[]): FakeFetch {
  const calls: RecordedCall[] = [];
  let index = 0;
  const impl = (async (url: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init });
    if (index >= script.length) throw new Error(`fake fetch script exhausted after ${script.length} calls`);
    const entry = script[index];
    index += 1;
    if (entry instanceof Error) throw entry;
    return typeof entry === "function" ? entry() : entry;
  }) as typeof fetch;
  return { impl, calls };
}

export function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

export function headerOf(call: RecordedCall, name: string): string | undefined {
  const headers = (call.init?.headers ?? {}) as Record<string, string>;
  return headers[name];
}

// ── base58btc encode (test-side inverse of the SDK's decoder) ────────────────────

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58btcEncode(bytes: Buffer): string {
  let n = BigInt(`0x${bytes.length ? bytes.toString("hex") : "0"}`);
  let out = "";
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = `1${out}`;
    else break;
  }
  return out;
}

// ── eddsa-jcs-2022 credential factory (mirrors the server's signer) ──────────────

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export interface SignedCredentialFixture {
  attestation: Record<string, unknown>;
  didDocument: Record<string, unknown>;
  issuer: string;
  verificationMethodId: string;
  privateKey: KeyObject;
}

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

/** Build a DID document + credential signed exactly the way verifyAttestation checks. */
export function signedCredentialFixture(
  overrides: {
    issuer?: string;
    subject?: Record<string, unknown>;
    types?: string[];
    authorizeAssertion?: boolean;
  } = {},
): SignedCredentialFixture {
  const issuer = overrides.issuer ?? "did:web:issuer.test";
  const vmId = `${issuer}#key-1`;
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const rawPub = spki.subarray(ED25519_SPKI_PREFIX.length);
  const publicKeyMultibase = `z${base58btcEncode(Buffer.concat([Buffer.from([0xed, 0x01]), rawPub]))}`;

  const didDocument: Record<string, unknown> = {
    id: issuer,
    assertionMethod: overrides.authorizeAssertion === false ? [] : [vmId],
    verificationMethod: [{ id: vmId, type: "Multikey", controller: issuer, publicKeyMultibase }],
  };

  const document: Record<string, unknown> = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: overrides.types ?? ["VerifiableCredential", "PaymentAttestationCredential"],
    issuer,
    credentialSubject: overrides.subject ?? {
      screen: { verdict: "CLEAR", payee: { verdict: "CLEAR" }, payer: { verdict: "CLEAR" } },
      settlement: { txid: "TX123" },
    },
  };

  const proofConfig: Record<string, unknown> = {
    type: "DataIntegrityProof",
    cryptosuite: "eddsa-jcs-2022",
    proofPurpose: "assertionMethod",
    verificationMethod: vmId,
  };
  const cfg = { ...proofConfig, "@context": document["@context"] };
  const signingInput = Buffer.concat([sha256(jcsCanonicalize(cfg)), sha256(jcsCanonicalize(document))]);
  const signature = cryptoSign(null, signingInput, privateKey);
  const attestation = { ...document, proof: { ...proofConfig, proofValue: `z${base58btcEncode(signature)}` } };

  return { attestation, didDocument, issuer, verificationMethodId: vmId, privateKey };
}
