/**
 * eddsa-jcs-2022 verification: the trust-critical path. A forged, tampered,
 * unauthorized, or unsigned attestation must FAIL; only the issuer's
 * assertion-authorized Ed25519 key over the exact JCS bytes may pass.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AttestationVerificationError,
  base58btcDecode,
  didWebDocumentUrl,
  fetchDidDocument,
  jcsCanonicalize,
  publicKeyBytesFromMultibase,
  resolveAssertionKeyBytes,
  verifyAttestation,
} from "../src/attestationVerify";
import { base58btcEncode, jsonResponse, makeFetch, signedCredentialFixture } from "./helpers";

// ── JCS canonicalization ─────────────────────────────────────────────────────────

test("jcsCanonicalize sorts keys, stays compact, preserves non-ASCII", () => {
  const bytes = jcsCanonicalize({ b: "é", a: [1, true, null], z: { y: "x" } });
  assert.equal(bytes.toString("utf8"), '{"a":[1,true,null],"b":"é","z":{"y":"x"}}');
});

test("jcsCanonicalize rejects floats (fail loud, never guess bytes)", () => {
  assert.throws(() => jcsCanonicalize({ amount: 1.5 }), AttestationVerificationError);
  assert.throws(() => jcsCanonicalize([0.1]), AttestationVerificationError);
});

test("jcsCanonicalize accepts integers and normalizes -0", () => {
  assert.equal(jcsCanonicalize({ n: 42, z: -0 }).toString("utf8"), '{"n":42,"z":0}');
});

// ── base58btc / multikey ─────────────────────────────────────────────────────────

test("base58btcDecode round-trips with the test encoder, incl. leading zeros", () => {
  for (const hex of ["00", "0000ff", "ba7816bf8f01", "ed01aa"]) {
    const buf = Buffer.from(hex, "hex");
    assert.deepEqual(base58btcDecode(base58btcEncode(buf)), buf, `hex ${hex}`);
  }
});

test("base58btcDecode rejects non-alphabet characters", () => {
  assert.throws(() => base58btcDecode("0OIl"), AttestationVerificationError);
});

test("publicKeyBytesFromMultibase enforces the ed25519-pub multicodec and length", () => {
  const raw = Buffer.alloc(32, 7);
  const good = `z${base58btcEncode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]))}`;
  assert.deepEqual(publicKeyBytesFromMultibase(good), raw);
  // wrong multicodec
  const bad = `z${base58btcEncode(Buffer.concat([Buffer.from([0xec, 0x01]), raw]))}`;
  assert.throws(() => publicKeyBytesFromMultibase(bad), /not an ed25519-pub multikey/);
  // wrong length
  const short = `z${base58btcEncode(Buffer.concat([Buffer.from([0xed, 0x01]), raw.subarray(0, 16)]))}`;
  assert.throws(() => publicKeyBytesFromMultibase(short), /must be 32 bytes/);
  // wrong multibase prefix
  assert.throws(() => publicKeyBytesFromMultibase("f00"), /base58btc/);
});

// ── did:web resolution ───────────────────────────────────────────────────────────

test("didWebDocumentUrl maps per W3C did:web §3.2", () => {
  assert.equal(didWebDocumentUrl("did:web:example.com"), "https://example.com/.well-known/did.json");
  assert.equal(didWebDocumentUrl("did:web:example.com:user:alice"), "https://example.com/user/alice/did.json");
  assert.equal(didWebDocumentUrl("did:web:localhost%3A8443"), "https://localhost:8443/.well-known/did.json");
  assert.throws(() => didWebDocumentUrl("did:key:z6Mk"), /not a did:web/);
  assert.throws(() => didWebDocumentUrl("did:web:"), /no host/);
});

test("fetchDidDocument fetches, checks status, and enforces the id binding", async () => {
  const doc = { id: "did:web:issuer.test", assertionMethod: [] };
  const ok = makeFetch(jsonResponse(200, doc));
  assert.deepEqual(await fetchDidDocument("did:web:issuer.test", { fetchImpl: ok.impl }), doc);
  assert.equal(ok.calls[0].url, "https://issuer.test/.well-known/did.json");

  const wrongId = makeFetch(jsonResponse(200, { id: "did:web:evil.test" }));
  await assert.rejects(fetchDidDocument("did:web:issuer.test", { fetchImpl: wrongId.impl }), /does not match/);

  const missing = makeFetch(jsonResponse(404, {}));
  await assert.rejects(fetchDidDocument("did:web:issuer.test", { fetchImpl: missing.impl }), /fetch failed \(404\)/);
});

test("resolveAssertionKeyBytes enforces assertionMethod authorization", () => {
  const fixture = signedCredentialFixture();
  const key = resolveAssertionKeyBytes(fixture.didDocument, fixture.verificationMethodId);
  assert.equal(key.length, 32);

  const unauthorized = signedCredentialFixture({ authorizeAssertion: false });
  assert.throws(
    () => resolveAssertionKeyBytes(unauthorized.didDocument, unauthorized.verificationMethodId),
    /not authorized under assertionMethod/,
  );

  assert.throws(
    () => resolveAssertionKeyBytes({ assertionMethod: ["did:web:x#nope"] }, "did:web:x#nope"),
    /not found in DID document/,
  );
});

// ── verifyAttestation ────────────────────────────────────────────────────────────

test("verifies a correctly signed attestation (pinned DID document)", async () => {
  const fixture = signedCredentialFixture();
  const v = await verifyAttestation(fixture.attestation, { didDocument: fixture.didDocument });
  assert.equal(v.verified, true);
  assert.equal(v.issuer, fixture.issuer);
  assert.equal(v.verificationMethod, fixture.verificationMethodId);
  assert.deepEqual(v.credentialTypes, ["VerifiableCredential", "PaymentAttestationCredential"]);
});

test("verifies via did:web resolution over the injected fetch", async () => {
  const fixture = signedCredentialFixture();
  const fake = makeFetch(jsonResponse(200, fixture.didDocument));
  const v = await verifyAttestation(fixture.attestation, { fetchImpl: fake.impl });
  assert.equal(v.verified, true);
  assert.equal(fake.calls[0].url, "https://issuer.test/.well-known/did.json");
});

test("FAILS on a tampered document (any byte change breaks the signature)", async () => {
  const fixture = signedCredentialFixture();
  const tampered = {
    ...fixture.attestation,
    credentialSubject: { screen: { verdict: "CLEAR", tampered: true } },
  };
  await assert.rejects(
    verifyAttestation(tampered, { didDocument: fixture.didDocument }),
    /signature does not verify/,
  );
});

test("FAILS on an unsigned attestation by design", async () => {
  await assert.rejects(verifyAttestation({ screen: { verdict: "CLEAR" } }), /unsigned/);
});

test("FAILS on an unsupported cryptosuite", async () => {
  const fixture = signedCredentialFixture();
  const proof = { ...(fixture.attestation.proof as Record<string, unknown>), cryptosuite: "eddsa-rdfc-2022" };
  await assert.rejects(
    verifyAttestation({ ...fixture.attestation, proof }, { didDocument: fixture.didDocument }),
    /unsupported cryptosuite/,
  );
});

test("FAILS on a wrong proofPurpose", async () => {
  const fixture = signedCredentialFixture();
  const proof = { ...(fixture.attestation.proof as Record<string, unknown>), proofPurpose: "authentication" };
  await assert.rejects(
    verifyAttestation({ ...fixture.attestation, proof }, { didDocument: fixture.didDocument }),
    /proofPurpose must be assertionMethod/,
  );
});

test("FAILS when the verification method belongs to a different DID than the issuer", async () => {
  const fixture = signedCredentialFixture();
  const proof = {
    ...(fixture.attestation.proof as Record<string, unknown>),
    verificationMethod: "did:web:evil.test#key-1",
  };
  await assert.rejects(
    verifyAttestation({ ...fixture.attestation, proof }, { didDocument: fixture.didDocument }),
    /does not belong to issuer/,
  );
});

test("FAILS when the key is not authorized under assertionMethod", async () => {
  const fixture = signedCredentialFixture({ authorizeAssertion: false });
  await assert.rejects(
    verifyAttestation(fixture.attestation, { didDocument: fixture.didDocument }),
    /not authorized under assertionMethod/,
  );
});

test("FAILS on an expectedIssuer mismatch", async () => {
  const fixture = signedCredentialFixture();
  await assert.rejects(
    verifyAttestation(fixture.attestation, {
      didDocument: fixture.didDocument,
      expectedIssuer: "did:web:dnsofmoney.com",
    }),
    /does not match expected/,
  );
});

test("FAILS when a signature from one credential is replayed onto another", async () => {
  const a = signedCredentialFixture();
  const b = signedCredentialFixture({ subject: { screen: { verdict: "BLOCKED" } } });
  const spliced = {
    ...b.attestation,
    proof: a.attestation.proof, // a's signature over a's bytes
  };
  await assert.rejects(
    verifyAttestation(spliced, { didDocument: b.didDocument }),
    /signature does not verify/,
  );
});
