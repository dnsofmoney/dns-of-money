/**
 * Extended cross-language conformance. `vectors/extended_vectors.json` comes
 * from the Python reference (`gen_extended_vectors.py`, in the Go SDK repo) and
 * covers what `canonical_vectors.json` does not: Python float repr, bool-as-int,
 * big ints, ensure_ascii escapes (DEL included), `str.strip()` separators,
 * nested values, the X-PAYMENT header bytes and the InvoiceID hash.
 *
 * Each request is stored as JSON TEXT and decoded with `parsePyJson`, so this
 * suite hashes the same values `json.loads` gave Python (10 and 10.0 stay apart).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parsePyJson, pyFloat } from "../src/_pyjson";
import { isValidPayUri } from "../src/addressing";
import { computeCanonicalHash } from "../src/canonicalHash";
import { computeSemanticHash, normalizeAction, normalizeMessage } from "../src/semanticNormalizer";
import { buildXPaymentHeader, invoiceIdHash } from "../src/x402Pay";

interface ExtendedVectors {
  a2a_protocol_core_version: string;
  canonical_hash: { name: string; request_json: string; expected_hash: string }[];
  semantic_hash: { name: string; message_json: string; normalized_action: string | null; expected_hash: string }[];
  normalize_action_ok: { input: string; output: string }[];
  x_payment_header: { tx_hash: string; payer: string; expected: string }[];
  invoice_id_hash: { input: string; expected: string }[];
}

const vectors: ExtendedVectors = JSON.parse(
  readFileSync(join(process.cwd(), "test", "vectors", "extended_vectors.json"), "utf8"),
);

test("extended vectors come from a2a-protocol-core 0.3.0", () => {
  assert.equal(vectors.a2a_protocol_core_version, "0.3.0");
});

test("extended canonical_hash is BYTE-IDENTICAL to Python", () => {
  for (const c of vectors.canonical_hash) {
    const request = parsePyJson(c.request_json) as Record<string, unknown>;
    assert.equal(computeCanonicalHash(request), c.expected_hash, `canonical_hash: ${c.name}`);
  }
});

test("extended semantic_hash is BYTE-IDENTICAL to Python", () => {
  for (const s of vectors.semantic_hash) {
    const normalized = normalizeMessage(parsePyJson(s.message_json) as Record<string, unknown>);
    assert.equal(normalized.action ?? null, s.normalized_action, `normalized action: ${s.name}`);
    assert.equal(computeSemanticHash(normalized), s.expected_hash, `semantic_hash: ${s.name}`);
  }
});

test("extended normalize_action strips like Python str.strip()", () => {
  for (const v of vectors.normalize_action_ok) {
    assert.equal(normalizeAction(v.input), v.output, `normalize: ${JSON.stringify(v.input)}`);
  }
  // U+FEFF is JS whitespace but not Python whitespace, so Python rejects it.
  assert.throws(() => normalizeAction("﻿send"));
});

test("X-PAYMENT header bytes match Python json.dumps", () => {
  for (const v of vectors.x_payment_header) {
    assert.equal(buildXPaymentHeader(v.tx_hash, v.payer || null), v.expected, `x_payment: ${v.tx_hash}`);
  }
});

test("invoiceIdHash matches Python", () => {
  for (const v of vectors.invoice_id_hash) {
    assert.equal(invoiceIdHash(v.input), v.expected, `invoice_id: ${JSON.stringify(v.input)}`);
  }
});

test("pyFloat and plain numbers hash like the parsed JSON text", () => {
  const byName = new Map(vectors.canonical_hash.map((c) => [c.name, c.expected_hash]));
  const base = { action: "send", currency: "USD", alias: "pay:x" };
  assert.equal(computeCanonicalHash({ ...base, amount: pyFloat(10) }), byName.get("float_trailing_zero"));
  assert.equal(computeCanonicalHash({ ...base, amount: 10 }), byName.get("int_amount"));
  assert.equal(computeCanonicalHash({ amount: 1e-5, currency: "USD" }), byName.get("float_exp_small"));
  assert.equal(
    computeCanonicalHash({ amount: 123456789012345678901234567890n, currency: "USD" }),
    byName.get("big_int"),
  );
});

test("pay: grammar rejects a trailing newline", () => {
  assert.equal(isValidPayUri("pay:a\n"), false);
  assert.equal(isValidPayUri("pay:a"), true);
});
