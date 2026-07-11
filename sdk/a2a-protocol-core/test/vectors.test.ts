/**
 * Cross-language conformance: this TS implementation must reproduce the EXACT
 * outputs of the Python `a2a-protocol-core` reference, proven against the shared
 * vector file (generated from Python, the source of truth). The canonical-hash
 * cases are the load-bearing ones: a byte-for-byte mismatch in serialization
 * would change the SHA-256 and fail here.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { isValidPayUri } from "../src/addressing";
import { computeCanonicalHash } from "../src/canonicalHash";
import { computeSemanticHash, normalizeAction } from "../src/semanticNormalizer";

interface Vectors {
  pay_uri: { input: string; valid: boolean }[];
  normalize_action: { ok: { input: string; output: string }[]; error: string[] };
  canonical_hash: { name: string; request: Record<string, unknown>; expected_hash: string }[];
  canonical_hash_equivalence_groups: string[][];
  semantic_hash: { name: string; normalized: Record<string, unknown>; expected_hash: string }[];
}

// `npm test` runs from the package root, so the shared vector file resolves here.
const vectors: Vectors = JSON.parse(
  readFileSync(join(process.cwd(), "test", "vectors", "canonical_vectors.json"), "utf8"),
);

test("pay_uri grammar matches Python", () => {
  for (const v of vectors.pay_uri) {
    assert.equal(isValidPayUri(v.input), v.valid, `pay_uri: ${JSON.stringify(v.input)}`);
  }
});

test("normalize_action (ok) matches Python", () => {
  for (const v of vectors.normalize_action.ok) {
    assert.equal(normalizeAction(v.input), v.output, `normalize: ${JSON.stringify(v.input)}`);
  }
});

test("normalize_action (error) matches Python", () => {
  for (const bad of vectors.normalize_action.error) {
    assert.throws(() => normalizeAction(bad), `expected throw for ${JSON.stringify(bad)}`);
  }
});

test("canonical_hash is BYTE-IDENTICAL to Python", () => {
  for (const c of vectors.canonical_hash) {
    assert.equal(computeCanonicalHash(c.request), c.expected_hash, `canonical_hash: ${c.name}`);
  }
});

test("canonical_hash equivalence groups collapse to one hash", () => {
  const byName = new Map(vectors.canonical_hash.map((c) => [c.name, c.expected_hash]));
  for (const group of vectors.canonical_hash_equivalence_groups) {
    const first = byName.get(group[0]);
    for (const name of group) {
      assert.equal(byName.get(name), first, `equivalence group member: ${name}`);
    }
  }
});

test("semantic_hash is BYTE-IDENTICAL to Python", () => {
  for (const s of vectors.semantic_hash) {
    assert.equal(computeSemanticHash(s.normalized), s.expected_hash, `semantic_hash: ${s.name}`);
  }
});
