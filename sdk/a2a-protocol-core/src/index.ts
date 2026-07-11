/**
 * @dnsofmoney/a2a-protocol-core — the open, deterministic core of the DNS of
 * Money A2A surface (TypeScript). 1:1 port of the Python `a2a-protocol-core`:
 * the `pay:` address grammar, canonical/semantic hashing that makes payment
 * intent stable across vocabularies, the A2A-041 wire schemas, and a thin
 * payment-hook client.
 *
 * Canonical/semantic hashes are byte-identical to the Python package — proven by
 * a shared cross-language test-vector file.
 */

export { PAY_URI_PATTERN, MAX_PAY_URI_LENGTH, isValidPayUri, assertValidPayUri } from "./addressing";

export { computeCanonicalHash } from "./canonicalHash";

export {
  SYNONYM_MAP,
  CANONICAL_ACTIONS,
  normalizeAction,
  normalizeMessage,
  computeSemanticHash,
} from "./semanticNormalizer";

export {
  validatePaymentHookRequest,
  type A2APaymentHookRequest,
  type A2APaymentHookResponse,
  type ResolutionDetail,
  type SettlementDetail,
  type A2ACapabilities,
} from "./schemas";

export { A2APaymentHookClient, type ClientOptions, type TriggerParams } from "./client";

export const VERSION = "0.1.0";
