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

export { A2APaymentHookClient, A2AClientError, type ClientOptions, type TriggerParams } from "./client";

export {
  DEFAULT_XRPL_WSS,
  X402PayError,
  decodePaymentRequired,
  buildXPaymentHeader,
  invoiceIdHash,
  invoiceFieldsFromRequirement,
  summarizeAttestation,
  fetchRequirement,
  fetchRequirementHeader,
  payAliasXrp,
  attestSettledPayment,
  buildAvmPaymentHeader,
  payAliasUsdcAlgorand,
  payAlias,
  signAndSubmitXrpViaXrpl,
  type AttestationSummary,
  type X402PaymentResult,
  type SignAndSubmitXrp,
  type SignAndSubmitXrpArgs,
  type BuildPaymentHeader,
  type AvmSignerOptions,
  type PayAliasXrpOptions,
  type PayAliasUsdcAlgorandOptions,
  type PayAliasOptions,
} from "./x402Pay";

export {
  screen,
  screenWithPaymentHeader,
  fetchScreenRequirementHeader,
  screenUrl,
  type ScreenResult,
  type ScreenOptions,
  type ScreenWithPaymentHeaderOptions,
} from "./screen";

export {
  CRYPTOSUITE,
  AttestationVerificationError,
  verifyAttestation,
  fetchDidDocument,
  didWebDocumentUrl,
  jcsCanonicalize,
  base58btcDecode,
  publicKeyBytesFromMultibase,
  resolveAssertionKeyBytes,
  type AttestationVerification,
  type VerifyAttestationOptions,
} from "./attestationVerify";

export { getWithRetries, RETRYABLE_STATUS, type GetWithRetriesOptions } from "./_retry";

export const VERSION = "0.3.0";
