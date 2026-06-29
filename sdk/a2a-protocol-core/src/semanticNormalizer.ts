/**
 * A2A-009 Semantic Normalizer — TS mirror of the Python `semantic_normalizer`.
 *
 * Collapses synonym verbs ("send", "pay", "transfer") into canonical action
 * codes so two agents describing the same intent with different words produce
 * the same canonical action — and therefore the same canonical hash.
 */

import { createHash } from "node:crypto";

import { pyJsonDumps } from "./_pyjson";

export const SYNONYM_MAP: Readonly<Record<string, string>> = {
  transfer: "EXECUTE_PAYMENT",
  send: "EXECUTE_PAYMENT",
  pay: "EXECUTE_PAYMENT",
  payment: "EXECUTE_PAYMENT",
  resolve: "QUERY",
  lookup: "QUERY",
  verify: "VERIFY",
  check: "VERIFY",
  confirm: "VERIFY",
  report: "REPORT",
  status: "REPORT",
};

export const CANONICAL_ACTIONS: ReadonlySet<string> = new Set([
  "EXECUTE_PAYMENT",
  "QUERY",
  "VERIFY",
  "REPORT",
]);

/**
 * Normalize a raw action string to its canonical form.
 * Lowercases, strips, collapses synonyms. Throws if the result is not canonical.
 */
export function normalizeAction(rawAction: string): string {
  const cleaned = rawAction.trim().toLowerCase();
  const canonical = SYNONYM_MAP[cleaned] ?? cleaned.toUpperCase();
  if (!CANONICAL_ACTIONS.has(canonical)) {
    const known = [...CANONICAL_ACTIONS].sort().join(", ");
    throw new Error(`Unknown action '${rawAction}' — not in [${known}]`);
  }
  return canonical;
}

/** Normalize the `action` field of an A2A message. Returns a copy; does not mutate. */
export function normalizeMessage<T extends Record<string, unknown>>(message: T): T {
  const normalized = structuredClone(message) as Record<string, unknown>;
  if ("action" in normalized) {
    normalized.action = normalizeAction(normalized.action as string);
  }
  return normalized as T;
}

/** SHA-256 of the canonical representation of a normalized message. */
export function computeSemanticHash(normalizedMessage: Record<string, unknown>): string {
  return createHash("sha256").update(pyJsonDumps(normalizedMessage), "utf8").digest("hex");
}
