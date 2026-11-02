/**
 * A2A-009 Semantic Normalizer — TS mirror of the Python `semantic_normalizer`.
 *
 * Collapses synonym verbs ("send", "pay", "transfer") into canonical action
 * codes so two agents describing the same intent with different words produce
 * the same canonical action — and therefore the same canonical hash.
 */

import { createHash } from "node:crypto";

import { pyClone, pyJsonDumps } from "./_pyjson";

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

// Python `str.strip()` with no argument removes every code point where
// `str.isspace()` is true. That set differs from JS `trim()`: it adds the
// separators U+001C..U+001F and U+0085, and it leaves U+FEFF in place.
const PY_WHITESPACE = new Set(
  "\t\n\v\f\r\u001c\u001d\u001e\u001f \u0085\u00a0\u1680" +
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a" +
    "\u2028\u2029\u202f\u205f\u3000",
);

/** Python `str.strip()` with no argument. */
export function pyStrip(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && PY_WHITESPACE.has(s[start])) start++;
  while (end > start && PY_WHITESPACE.has(s[end - 1])) end--;
  return s.slice(start, end);
}

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
  const cleaned = pyStrip(rawAction).toLowerCase();
  const canonical = SYNONYM_MAP[cleaned] ?? cleaned.toUpperCase();
  if (!CANONICAL_ACTIONS.has(canonical)) {
    const known = [...CANONICAL_ACTIONS].sort().join(", ");
    throw new Error(`Unknown action '${rawAction}' — not in [${known}]`);
  }
  return canonical;
}

/** Normalize the `action` field of an A2A message. Returns a copy; does not mutate. */
export function normalizeMessage<T extends Record<string, unknown>>(message: T): T {
  const normalized = pyClone(message) as Record<string, unknown>;
  if ("action" in normalized) {
    normalized.action = normalizeAction(normalized.action as string);
  }
  return normalized as T;
}

/** SHA-256 of the canonical representation of a normalized message. */
export function computeSemanticHash(normalizedMessage: Record<string, unknown>): string {
  return createHash("sha256").update(pyJsonDumps(normalizedMessage), "utf8").digest("hex");
}
