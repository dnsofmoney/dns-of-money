/**
 * A2A-008 Canonical Hash — TS mirror of the Python `canonical_hash` module.
 *
 * SHA-256 over the semantically significant fields of a payment request. Two
 * semantically equivalent payments (same amount, currency, rail, alias,
 * category, normalized action) produce the same hash regardless of
 * session/trace/idempotency metadata. Byte-identical to the Python reference
 * (see `_pyjson` for the serialization contract).
 */

import { createHash } from "node:crypto";

import { pyJsonDumps } from "./_pyjson";
import { normalizeAction } from "./semanticNormalizer";

// Fields that carry semantic payment meaning — included if present. (Mirrors the
// Python `_INCLUDED_KEYS`; everything else — session_id, request_id, trace_id,
// timestamp, idempotency_key, memo, payload_hash, canonical_hash, created_at,
// updated_at, … — is excluded by omission.)
const INCLUDED_KEYS = [
  "amount",
  "currency",
  "rail",
  "preferred_rail",
  "alias",
  "alias_uri",
  "alias_name",
  "payment_category",
  "payment_type",
  "action",
] as const;

/**
 * Compute the SHA-256 canonical hash of the semantically significant fields.
 *
 * - Include only the whitelisted keys above (drops all noise/metadata).
 * - Stringify numeric values (pass strings to stay byte-identical cross-language).
 * - Normalize `action` via the A2A-009 normalizer; keep raw if unrecognized.
 * - Serialize with sorted keys + Python's default separators, then SHA-256.
 */
export function computeCanonicalHash(paymentRequest: Record<string, unknown>): string {
  const canonical: Record<string, string> = {};
  for (const key of INCLUDED_KEYS) {
    const val = paymentRequest[key];
    if (val === null || val === undefined) continue;

    let out = typeof val === "number" ? String(val) : String(val);
    if (key === "action" && typeof val === "string") {
      try {
        out = normalizeAction(val);
      } catch {
        out = val; // keep raw if not a recognized action
      }
    }
    canonical[key] = out;
  }
  return createHash("sha256").update(pyJsonDumps(canonical), "utf8").digest("hex");
}
