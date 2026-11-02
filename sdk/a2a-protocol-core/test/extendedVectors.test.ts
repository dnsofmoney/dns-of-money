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

// Review cases for PR #26. Expected hashes were RECORDED from Python
// a2a-protocol-core 0.3.0 (json.loads + compute_*_hash) on 2026-11-02.
const PYTHON_RECORDED = {
  canonical: [
    {
      name: "proto_key",
      json: '{"__proto__": {"amount": "999"}, "currency": "XRP"}',
      hash: "a489845d54ec384da3e6b6a9d3d0d002b3485602e43e041bb7f43f4b298c7fcc",
    },
    {
      name: "proto_nested",
      json: '{"amount": "1", "payment_category": {"__proto__": {"x": 1}, "a": 2}}',
      hash: "f1c196a3ba828c3a4bfdbcf1aead5df62a8742f45288b2949160cdba379ad8fb",
    },
    {
      name: "nan_amount",
      json: '{"amount": NaN, "currency": "USD"}',
      hash: "e82a4794643082d566e555e35d26eaa5bc1e0ef3c679d578f257453297c23299",
    },
    {
      name: "inf_amount",
      json: '{"amount": -Infinity, "currency": "USD"}',
      hash: "692b65fea0df6ccc9fc26a0f50c7f8ac9761da7ebc08402169f9b3c1a8b8ec1a",
    },
  ],
  semantic: [
    {
      name: "proto_key",
      json: '{"__proto__": {"x": 1}, "action": "send"}',
      hash: "24733965e0140729c7ef75e9edc09fca69c17342c072dded6dc97d69a7865324",
    },
    {
      name: "astral_vs_bmp_keys",
      json: '{"\\uff01": 1, "\\ud83d\\ude00": 2, "action": "pay"}',
      hash: "fba3c835df60161baa3273add31b4b1bd22b461d6adaa076dc751e7916ceec03",
    },
  ],
};

test("a __proto__ key is a plain key, as in a Python dict", () => {
  for (const c of PYTHON_RECORDED.canonical) {
    const request = parsePyJson(c.json) as Record<string, unknown>;
    assert.equal(computeCanonicalHash(request), c.hash, `canonical: ${c.name}`);
  }
  for (const s of PYTHON_RECORDED.semantic) {
    // Both decoders must agree with Python: parsePyJson and native JSON.parse
    // (which also makes "__proto__" an own key).
    for (const decoded of [parsePyJson(s.json), JSON.parse(s.json)]) {
      const normalized = normalizeMessage(decoded as Record<string, unknown>);
      assert.equal(computeSemanticHash(normalized), s.hash, `semantic: ${s.name}`);
    }
  }
});

test("canonical hash ignores inherited fields", () => {
  const request = Object.create({ amount: "999" }) as Record<string, unknown>;
  request.currency = "XRP";
  assert.equal(computeCanonicalHash(request), PYTHON_RECORDED.canonical[0].hash);
});

test("ints beyond Python's 4300-digit str limit are refused", () => {
  assert.throws(() => parsePyJson('{"amount": ' + "9".repeat(4301) + "}"));
  assert.throws(() => computeCanonicalHash({ amount: 10n ** 4300n }));
  assert.doesNotThrow(() => parsePyJson('{"amount": ' + "9".repeat(4300) + "}"));
});

test("pay: grammar rejects a trailing newline", () => {
  assert.equal(isValidPayUri("pay:a\n"), false);
  assert.equal(isValidPayUri("pay:a"), true);
});
