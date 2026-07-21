/**
 * Paid counterparty screen client — "screen before you pay". TS mirror of the
 * Python `screen`.
 *
 * `GET /api/v1/x402/screen/{target}` is DNS of Money's distributable paid
 * endpoint: pay the screening fee (an x402 payment at the service's declared
 * price) and receive an OFAC + resolution attestation about a CALLER-NAMED
 * target — a `pay:` alias or a raw any-chain address. The screened party is
 * decoupled from the paid party, which is exactly what an agent needs before
 * it pays a third party.
 *
 *   import { screen } from "@dnsofmoney/a2a-protocol-core";
 *
 *   const result = await screen({
 *     baseUrl: "https://api.dnsofmoney.com",
 *     target: "pay:vendor.alpha",              // or a raw address on any chain
 *     apiKey: "...",                           // settle leg requires a tenant key
 *     algorandMnemonic: "...25 words...",      // fee is USDC on Algorand by default
 *     verify: true,                            // check the attestation signature
 *   });
 *   if (result.verdict === "CLEAR") { ...proceed to pay the vendor... }
 *
 * The fee leg reuses the same non-custodial machinery as the pay path: USDC on
 * Algorand via the official x402 client (optional peer deps) or XRP via a
 * local XRPL signature (optional `xrpl` peer dep). `verify: true` additionally
 * checks the attestation's eddsa-jcs-2022 proof against the issuer's did:web
 * document (no extra install — `node:crypto`).
 */

import { getWithRetries } from "./_retry";
import { AttestationVerification, verifyAttestation } from "./attestationVerify";
import * as x402Pay from "./x402Pay";
import {
  AttestationSummary,
  BuildPaymentHeader,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_XRPL_WSS,
  HttpOptions,
  SignAndSubmitXrp,
  X402PayError,
  buildXPaymentHeader,
  decodePaymentRequired,
  invoiceFieldsFromRequirement,
  invoiceIdHash,
  summarizeAttestation,
} from "./x402Pay";

export function screenUrl(baseUrl: string, target: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/x402/screen/${target}`;
}

/** The screen deliverable: the target's verdict + the signed attestation. */
export interface ScreenResult {
  target: string;
  /** overall: CLEAR / REVIEW / BLOCKED / UNKNOWN */
  verdict?: string;
  attestation: Record<string, unknown>;
  proof: Record<string, unknown>;
  summary: AttestationSummary;
  /** Set when verify: true. */
  verification?: AttestationVerification;
  idempotent: boolean;
  raw: Record<string, unknown>;
}

/**
 * GET the screen 402 challenge; return the raw `PAYMENT-REQUIRED` header.
 *
 * The fee amount is server-set (the screening service's declared price) — the
 * caller never names it.
 */
export async function fetchScreenRequirementHeader(options: {
  baseUrl: string;
  target: string;
  currency?: string;
} & HttpOptions): Promise<string> {
  const resp = await getWithRetries(screenUrl(options.baseUrl, options.target), {
    params: { currency: options.currency ?? "USDC" },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl,
  });
  if (resp.status !== 402) {
    const text = await resp.text().catch(() => "");
    throw new X402PayError(`expected a 402 challenge, got ${resp.status}: ${text.slice(0, 200)}`);
  }
  const header = resp.headers.get("PAYMENT-REQUIRED");
  if (!header) throw new X402PayError("402 response missing the PAYMENT-REQUIRED header");
  return header;
}

export interface ScreenWithPaymentHeaderOptions extends HttpOptions {
  baseUrl: string;
  target: string;
  paymentHeader: string;
  apiKey: string;
  currency?: string;
  /** Also check the attestation's signature against the issuer's did:web key. */
  verify?: boolean;
  expectedIssuer?: string;
  /** Pinned DID document for offline verification (skips the did:web fetch). */
  didDocument?: Record<string, unknown>;
}

/**
 * Settle the screen fee with a caller-built payment header; return the result.
 *
 * The lower-level leg — use this when your own wallet stack built the x402
 * payment. `screen` wires the whole flow for you.
 */
export async function screenWithPaymentHeader(options: ScreenWithPaymentHeaderOptions): Promise<ScreenResult> {
  // Retry-safe: the settle leg is idempotent server-side (checked before verification).
  const resp = await getWithRetries(screenUrl(options.baseUrl, options.target), {
    params: { currency: options.currency ?? "USDC" },
    headers: { "X-PAYMENT": options.paymentHeader, "X-API-Key": options.apiKey },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl,
  });
  if (resp.status !== 200) {
    const text = await resp.text().catch(() => "");
    throw new X402PayError(`screen settle failed ${resp.status}: ${text.slice(0, 300)}`);
  }
  const body = (await resp.json()) as Record<string, unknown>;
  const attestation = (body.attestation ?? {}) as Record<string, unknown>;
  let verification: AttestationVerification | undefined;
  if (options.verify) {
    verification = await verifyAttestation(attestation, {
      expectedIssuer: options.expectedIssuer,
      didDocument: options.didDocument,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
  }
  // CounterpartyScreenCredential: overall verdict lives at subject.screen.verdict
  // (signed VC wraps the body under credentialSubject; unsigned form is flat).
  const subject = (attestation.credentialSubject ?? attestation) as Record<string, unknown>;
  const verdict = ((subject.screen ?? {}) as Record<string, unknown>).verdict as string | undefined;
  return {
    target: options.target,
    verdict,
    attestation,
    proof: (body.proof ?? {}) as Record<string, unknown>,
    summary: summarizeAttestation(attestation),
    verification,
    idempotent: Boolean(body.idempotent),
    raw: body,
  };
}

export interface ScreenOptions extends HttpOptions {
  baseUrl: string;
  target: string;
  apiKey: string;
  /** "USDC" (Algorand, default) or "XRP" (XRPL). */
  currency?: string;
  algorandMnemonic?: string;
  algorandSecretKey?: Uint8Array | string;
  xrplSeed?: string;
  xrplWssUrl?: string;
  verify?: boolean;
  expectedIssuer?: string;
  didDocument?: Record<string, unknown>;
  /** Bring-your-own wallet stacks (replace the official-mechanism defaults). */
  buildPaymentHeader?: BuildPaymentHeader;
  signAndSubmit?: SignAndSubmitXrp;
}

/**
 * Screen a counterparty end to end: pay the fee, get the attested verdict.
 *
 * 402 → pay the server-priced fee from your own wallet (USDC-on-Algorand by
 * default; XRP with `currency: "XRP"` + `xrplSeed`) → the paid deliverable is
 * the OFAC + resolution attestation about `target`. Non-custodial: keys sign
 * locally and never leave the process. `verify: true` also checks the
 * attestation signature against the issuer's did:web key.
 */
export async function screen(options: ScreenOptions): Promise<ScreenResult> {
  const cur = (options.currency ?? "USDC").toUpperCase();
  const raw = await fetchScreenRequirementHeader({
    baseUrl: options.baseUrl,
    target: options.target,
    currency: cur,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  let header: string;
  if (cur === "USDC") {
    const build =
      options.buildPaymentHeader ??
      ((h: string) =>
        x402Pay.buildAvmPaymentHeader(h, {
          mnemonic: options.algorandMnemonic,
          secretKey: options.algorandSecretKey,
        }));
    header = await build(raw);
  } else if (cur === "XRP") {
    if (!options.signAndSubmit && !options.xrplSeed) {
      throw new X402PayError("XRP fee payment requires xrplSeed");
    }
    const req = decodePaymentRequired(raw);
    const { invoiceId, sourceTag } = invoiceFieldsFromRequirement(req);
    const signAndSubmit = options.signAndSubmit ?? x402Pay.signAndSubmitXrpViaXrpl;
    const { txHash, payer } = await signAndSubmit({
      payTo: req.payTo as string,
      drops: req.maxAmountRequired as string,
      seed: options.xrplSeed ?? "",
      wssUrl: options.xrplWssUrl ?? DEFAULT_XRPL_WSS,
      invoiceId: invoiceId ? invoiceIdHash(invoiceId) : undefined,
      sourceTag,
    });
    header = buildXPaymentHeader(txHash, payer);
  } else {
    throw new X402PayError(
      `unsupported fee currency ${JSON.stringify(options.currency)} — USDC (Algorand) or XRP (XRPL)`,
    );
  }

  return screenWithPaymentHeader({
    baseUrl: options.baseUrl,
    target: options.target,
    paymentHeader: header,
    apiKey: options.apiKey,
    currency: cur,
    verify: options.verify,
    expectedIssuer: options.expectedIssuer,
    didDocument: options.didDocument,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
}
