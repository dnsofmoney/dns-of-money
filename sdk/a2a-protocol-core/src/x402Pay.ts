/**
 * One-call x402 pay-path — pay a `pay:` alias from YOUR own wallet. TS mirror
 * of the Python `x402_pay`.
 *
 * Non-custodial by construction: keys sign locally, in *your* process, and are
 * never sent over the wire. DNS of Money verifies an already-settled (or
 * facilitator-submitted) payment and returns metadata — it never holds your
 * keys or your funds.
 *
 *   import { payAliasXrp } from "@dnsofmoney/a2a-protocol-core";
 *
 *   const result = await payAliasXrp({
 *     baseUrl: "https://api.dnsofmoney.com",
 *     alias: "pay:vendor.alpha",
 *     amountXrp: "0.10",
 *     seed: "s...",            // YOUR XRPL wallet seed — signs locally, never sent
 *     apiKey: "fas_live_...",  // attributes the settle leg
 *   });
 *   console.log(result.txHash, result.summary.verdict);
 *
 * The pure helpers (`decodePaymentRequired`, `buildXPaymentHeader`,
 * `summarizeAttestation`, `invoiceFieldsFromRequirement`) have no network or
 * wallet dependency; the signing paths lazy-`require` their OPTIONAL peer
 * dependencies (`xrpl` for XRPL; `@x402/core` + `@x402/avm` + `algosdk` for
 * USDC-on-Algorand) so the base package stays dependency-free.
 */

import { createHash } from "node:crypto";

import { getWithRetries } from "./_retry";

/** Public mainnet XRPL WebSocket (multi-host cluster). Override for testnet/devnet.
 * (The Python SDK defaults to the same cluster over JSON-RPC; xrpl.js speaks WSS.) */
export const DEFAULT_XRPL_WSS = "wss://xrplcluster.com";
export const DEFAULT_TIMEOUT_MS = 60_000;

/** Raised when the x402 pay-path fails (bad challenge, failed settle, or signing error). */
export class X402PayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "X402PayError";
  }
}

// ── Pure helpers (no network, no wallet deps — unit-tested) ──────────────────────

/** Decode the base64(JSON) PAYMENT-REQUIRED header into the requirement object. */
export function decodePaymentRequired(headerValue: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(headerValue, "base64").toString("utf8"));
}

/** Build the X-PAYMENT header: base64(JSON) proof of the settled tx hash. */
export function buildXPaymentHeader(txHash: string, payer?: string | null): string {
  const payload: Record<string, string> = { txHash };
  if (payer) payload.payer = payer;
  const envelope = { x402Version: 2, payload };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
}

/**
 * The on-chain InvoiceID that binds a payment to a 402 challenge.
 *
 * Matches the server verifier: SHA-256 of the requirement's `invoiceId`, hex,
 * uppercased. Setting it on the Payment replay-binds the tx to this challenge.
 */
export function invoiceIdHash(invoiceId: string): string {
  return createHash("sha256").update(invoiceId, "utf8").digest("hex").toUpperCase();
}

/**
 * Read `invoiceId`/`sourceTag` from an XRP x402 requirement.
 *
 * The XRPL exact scheme carries scheme fields in `extra`; the top-level copies
 * are DNS of Money's own deprecated mirrors (removed after 2026-10-01). Prefer
 * `extra`, fall back to top-level so this client still works against
 * not-yet-updated servers.
 */
export function invoiceFieldsFromRequirement(req: Record<string, unknown>): {
  invoiceId?: string;
  sourceTag?: number;
} {
  const extra = (req.extra ?? {}) as Record<string, unknown>;
  const invoiceId = (extra.invoiceId as string | undefined) || (req.invoiceId as string | undefined) || undefined;
  const sourceTag =
    extra.sourceTag !== undefined && extra.sourceTag !== null
      ? (extra.sourceTag as number)
      : (req.sourceTag as number | undefined) ?? undefined;
  return { invoiceId, sourceTag };
}

/** The deliverable at a glance — the resolve/verify/OFAC-screen verdicts. */
export interface AttestationSummary {
  /** overall: CLEAR / REVIEW / BLOCKED / UNKNOWN */
  verdict?: string;
  payeeVerdict?: string;
  payerVerdict?: string;
  txId?: string;
  signed: boolean;
}

/** One-glance summary of the attestation (signed VC or unsigned flat form). */
export function summarizeAttestation(attestation: Record<string, unknown>): AttestationSummary {
  const subject = (attestation.credentialSubject ?? attestation) as Record<string, unknown>;
  const screen = (subject.screen ?? {}) as Record<string, unknown>;
  const settlement = (subject.settlement ?? {}) as Record<string, unknown>;
  return {
    verdict: screen.verdict as string | undefined,
    payeeVerdict: ((screen.payee ?? {}) as Record<string, unknown>).verdict as string | undefined,
    payerVerdict: ((screen.payer ?? {}) as Record<string, unknown>).verdict as string | undefined,
    txId: settlement.txid as string | undefined,
    signed: Boolean(attestation.proof),
  };
}

/** The outcome of a completed x402 pay-path. */
export interface X402PaymentResult {
  txHash: string;
  payer?: string;
  settled: boolean;
  idempotent: boolean;
  attestation: Record<string, unknown>;
  proof: Record<string, unknown>;
  summary: AttestationSummary;
  raw: Record<string, unknown>;
}

// ── HTTP legs (challenge + settle) ───────────────────────────────────────────────

function payUrl(baseUrl: string, alias: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/x402/pay/${alias}`;
}

export interface HttpOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * GET the 402 challenge and return the decoded XRP payment requirement.
 *
 * Throws `X402PayError` if the server does not answer 402 (e.g. x402 disabled,
 * alias not payable, or the alias has no XRPL address).
 */
export async function fetchRequirement(options: {
  baseUrl: string;
  alias: string;
  amountXrp: string | number;
} & HttpOptions): Promise<Record<string, unknown>> {
  const resp = await getWithRetries(payUrl(options.baseUrl, options.alias), {
    params: { amount: String(options.amountXrp), currency: "XRP" },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl,
  });
  if (resp.status !== 402) {
    const text = await resp.text().catch(() => "");
    throw new X402PayError(`expected a 402 challenge, got ${resp.status}: ${text.slice(0, 200)}`);
  }
  const header = resp.headers.get("PAYMENT-REQUIRED");
  if (!header) throw new X402PayError("402 response missing the PAYMENT-REQUIRED header");
  return decodePaymentRequired(header);
}

/**
 * GET the 402 challenge and return the RAW `PAYMENT-REQUIRED` header value.
 *
 * Omit `amount` to be quoted the alias's declared price (enforced pricing) —
 * for a priced endpoint the server names the number either way. The raw header
 * is what the official x402 client's decoder consumes, so callers building
 * payments with it should start here rather than `fetchRequirement`.
 */
export async function fetchRequirementHeader(options: {
  baseUrl: string;
  alias: string;
  amount?: string | number;
  currency?: string;
} & HttpOptions): Promise<string> {
  const params: Record<string, string> = { currency: options.currency ?? "USDC" };
  if (options.amount !== undefined && options.amount !== null) params.amount = String(options.amount);
  const resp = await getWithRetries(payUrl(options.baseUrl, options.alias), {
    params,
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

async function settleWithHeader(options: {
  baseUrl: string;
  alias: string;
  params: Record<string, string>;
  paymentHeader: string;
  apiKey: string;
} & HttpOptions): Promise<Record<string, unknown>> {
  // Retry-safe: the server checks idempotency BEFORE verification, so re-sending
  // the same payment proof returns the recorded outcome, never a double-settle.
  const resp = await getWithRetries(payUrl(options.baseUrl, options.alias), {
    params: options.params,
    headers: { "X-PAYMENT": options.paymentHeader, "X-API-Key": options.apiKey },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl,
  });
  if (resp.status !== 200) {
    const text = await resp.text().catch(() => "");
    throw new X402PayError(`settle leg failed ${resp.status}: ${text.slice(0, 300)}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

function resultFromBody(body: Record<string, unknown>): X402PaymentResult {
  const attestation = (body.attestation ?? {}) as Record<string, unknown>;
  const proof = (body.proof ?? {}) as Record<string, unknown>;
  return {
    txHash: (proof.transaction as string) || "",
    payer: proof.payer as string | undefined,
    settled: Boolean(body.settled),
    idempotent: Boolean(body.idempotent),
    attestation,
    proof,
    summary: summarizeAttestation(attestation),
    raw: body,
  };
}

// ── XRPL signing (lazy `xrpl` require — an OPTIONAL peer dependency) ─────────────

export interface SignAndSubmitXrpArgs {
  payTo: string;
  drops: string;
  seed: string;
  wssUrl: string;
  invoiceId?: string;
  sourceTag?: number;
}

/** Bring-your-own signing stack: return the settled tx hash + payer address. */
export type SignAndSubmitXrp = (args: SignAndSubmitXrpArgs) => Promise<{ txHash: string; payer: string }>;

/** Default XRPL signer: sign + submit locally via the optional `xrpl` peer dep. */
export async function signAndSubmitXrpViaXrpl(
  args: SignAndSubmitXrpArgs,
): Promise<{ txHash: string; payer: string }> {
  let xrpl: any;
  try {
    xrpl = require("xrpl");
  } catch {
    throw new X402PayError("signing requires the optional 'xrpl' peer dependency — install with: npm install xrpl");
  }
  const wallet = xrpl.Wallet.fromSeed(args.seed);
  const client = new xrpl.Client(args.wssUrl);
  await client.connect();
  try {
    const tx: Record<string, unknown> = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: args.payTo,
      Amount: String(args.drops),
    };
    if (args.invoiceId) tx.InvoiceID = args.invoiceId;
    if (args.sourceTag !== undefined && args.sourceTag !== null) tx.SourceTag = args.sourceTag;
    const resp = await client.submitAndWait(tx, { autofill: true, wallet });
    const result = resp?.result ?? {};
    const txResult = (result.meta as Record<string, unknown> | undefined)?.TransactionResult;
    if (result.validated && txResult === "tesSUCCESS") {
      return { txHash: result.hash as string, payer: wallet.address as string };
    }
    throw new X402PayError(`XRPL payment did not succeed (result=${String(txResult)})`);
  } finally {
    await client.disconnect();
  }
}

// ── One-call entry points ────────────────────────────────────────────────────────

export interface PayAliasXrpOptions extends HttpOptions {
  baseUrl: string;
  alias: string;
  amountXrp: string | number;
  /** YOUR XRPL wallet seed — signs locally, never transmitted. */
  seed: string;
  apiKey: string;
  xrplWssUrl?: string;
  /** Bring-your-own wallet stack (replaces the default xrpl.js signer). */
  signAndSubmit?: SignAndSubmitXrp;
}

/**
 * Pay a `pay:` alias in XRP from your own wallet, end to end.
 *
 * Resolve the x402 requirement (402 challenge) → sign + submit the XRP payment
 * locally with `seed` → hand the proof to DNS of Money for read-only verify +
 * the signed attestation. Non-custodial: the seed signs in-process and is never
 * transmitted. Requires the optional `xrpl` peer dependency (or pass your own
 * `signAndSubmit`). Throws `X402PayError` on failure.
 */
export async function payAliasXrp(options: PayAliasXrpOptions): Promise<X402PaymentResult> {
  const req = await fetchRequirement(options);
  const { invoiceId, sourceTag } = invoiceFieldsFromRequirement(req);
  const signAndSubmit = options.signAndSubmit ?? signAndSubmitXrpViaXrpl;
  const { txHash, payer } = await signAndSubmit({
    payTo: req.payTo as string,
    drops: req.maxAmountRequired as string,
    seed: options.seed,
    wssUrl: options.xrplWssUrl ?? DEFAULT_XRPL_WSS,
    invoiceId: invoiceId ? invoiceIdHash(invoiceId) : undefined,
    sourceTag,
  });
  const body = await settleWithHeader({
    baseUrl: options.baseUrl,
    alias: options.alias,
    params: { amount: String(options.amountXrp), currency: "XRP" },
    paymentHeader: buildXPaymentHeader(txHash, payer),
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  return resultFromBody(body);
}

/**
 * Get the attestation for a payment you ALREADY settled on XRPL (bring-your-own tx).
 *
 * Same settle leg as `payAliasXrp`, minus the signing — for agents that pay
 * through their own wallet stack (or a Coinbase Agentic Wallet) and just want
 * the read-only verify + attestation. No wallet dependency needed.
 */
export async function attestSettledPayment(options: {
  baseUrl: string;
  alias: string;
  amountXrp: string | number;
  txHash: string;
  apiKey: string;
  payer?: string;
} & HttpOptions): Promise<X402PaymentResult> {
  const body = await settleWithHeader({
    baseUrl: options.baseUrl,
    alias: options.alias,
    params: { amount: String(options.amountXrp), currency: "XRP" },
    paymentHeader: buildXPaymentHeader(options.txHash, options.payer),
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  return resultFromBody(body);
}

// ── USDC-on-Algorand pay path (official x402 client — optional peer deps) ────────

export interface AvmSignerOptions {
  /** 25-word Algorand mnemonic (signs locally, never transmitted). */
  mnemonic?: string;
  /** Raw 64-byte Algorand secret key, or base64 thereof. */
  secretKey?: Uint8Array | string;
  /** Algod endpoint override (defaults to the scheme's public node for the network). */
  algodUrl?: string;
  algodToken?: string;
}

/** Build the payment header for a USDC challenge with a caller-chosen stack. */
export type BuildPaymentHeader = (paymentRequiredHeader: string) => string | Promise<string>;

function algorandSecret(algosdk: any, options: AvmSignerOptions): Uint8Array {
  if (options.mnemonic) {
    return algosdk.mnemonicToSecretKey(options.mnemonic).sk as Uint8Array;
  }
  if (options.secretKey !== undefined && options.secretKey !== null) {
    const sk =
      typeof options.secretKey === "string"
        ? new Uint8Array(Buffer.from(options.secretKey, "base64"))
        : new Uint8Array(options.secretKey);
    if (sk.length !== 64) throw new X402PayError("algorand secretKey must be 64 bytes (or base64 thereof)");
    return sk;
  }
  throw new X402PayError("provide algorand mnemonic (25 words) or secretKey");
}

/**
 * Build the payment header for a USDC-on-Algorand 402 challenge.
 *
 * Drives the OFFICIAL x402 client mechanisms (never a hand-rolled group):
 * decode the v2 `PAYMENT-REQUIRED` envelope, sign the USDC transfer leg of the
 * atomic group locally with the caller's key, and encode the payment payload
 * header. The facilitator co-signs the fee leg and submits — we never custody,
 * and the key never leaves this process. Requires the optional peer
 * dependencies `@x402/core`, `@x402/avm`, and `algosdk`.
 */
export async function buildAvmPaymentHeader(
  paymentRequiredHeader: string,
  options: AvmSignerOptions = {},
): Promise<string> {
  let core: any;
  let http: any;
  let avm: any;
  let algosdk: any;
  try {
    core = require("@x402/core/client");
    http = require("@x402/core/http");
    avm = require("@x402/avm");
    algosdk = require("algosdk");
  } catch {
    throw new X402PayError(
      "USDC-on-Algorand payment requires the optional peer dependencies — " +
        "install with: npm install @x402/core @x402/avm algosdk",
    );
  }
  const secret = algorandSecret(algosdk, options);
  const address = algosdk.encodeAddress(secret.slice(32)) as string;
  // ClientAvmSigner over algosdk. The x402 SDK passes raw msgpack bytes; sign
  // ONLY the indexes the mechanism asks for (the agent's USDC transfer leg) —
  // the unsigned fee-payer leg is co-signed by the facilitator, never by us.
  const signer = {
    address,
    async signTransactions(txns: Uint8Array[], indexesToSign?: number[]): Promise<(Uint8Array | null)[]> {
      return txns.map((txnBytes, i) =>
        indexesToSign === undefined || indexesToSign.includes(i)
          ? (algosdk.decodeUnsignedTransaction(txnBytes).signTxn(secret) as Uint8Array)
          : null,
      );
    },
  };
  const schemeConfig =
    options.algodUrl !== undefined ? { algodUrl: options.algodUrl, algodToken: options.algodToken } : undefined;
  const required = http.decodePaymentRequiredHeader(paymentRequiredHeader);
  const client = new core.x402Client();
  const networks = new Set<string>(
    ((required.accepts ?? []) as { network?: string }[]).map((a) => a.network).filter(Boolean) as string[],
  );
  for (const network of networks) client.register(network, new avm.ExactAvmScheme(signer, schemeConfig));
  const payload = await client.createPaymentPayload(required);
  return http.encodePaymentSignatureHeader(payload) as string;
}

export interface PayAliasUsdcAlgorandOptions extends HttpOptions, AvmSignerOptions {
  baseUrl: string;
  alias: string;
  apiKey: string;
  /** Omit to pay the alias's declared (enforced) price. */
  amountUsdc?: string | number;
  /** Bring-your-own wallet stack (replaces the official-mechanism builder). */
  buildPaymentHeader?: BuildPaymentHeader;
}

/**
 * Pay a `pay:` alias in USDC on Algorand from your own wallet, end to end.
 *
 * Fetch the 402 → sign the USDC transfer leg locally (official x402 AVM
 * mechanism) → the server + facilitator verify, co-sign the fee leg, and
 * submit → you get the signed attestation back. Omit `amountUsdc` to pay the
 * alias's declared price — this is the path that pays DNS of Money's own
 * priced endpoints. Non-custodial throughout.
 */
export async function payAliasUsdcAlgorand(options: PayAliasUsdcAlgorandOptions): Promise<X402PaymentResult> {
  const params: Record<string, string> = { currency: "USDC" };
  if (options.amountUsdc !== undefined && options.amountUsdc !== null) params.amount = String(options.amountUsdc);
  const raw = await fetchRequirementHeader({
    baseUrl: options.baseUrl,
    alias: options.alias,
    amount: options.amountUsdc,
    currency: "USDC",
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  const build = options.buildPaymentHeader ?? ((header: string) => buildAvmPaymentHeader(header, options));
  const header = await build(raw);
  const body = await settleWithHeader({
    baseUrl: options.baseUrl,
    alias: options.alias,
    params,
    paymentHeader: header,
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  return resultFromBody(body);
}

export interface PayAliasOptions extends HttpOptions {
  baseUrl: string;
  alias: string;
  apiKey: string;
  amount?: string | number;
  /** "XRP" (XRPL) or "USDC" (Algorand). */
  currency?: string;
  xrplSeed?: string;
  algorandMnemonic?: string;
  algorandSecretKey?: Uint8Array | string;
  xrplWssUrl?: string;
  signAndSubmit?: SignAndSubmitXrp;
  buildPaymentHeader?: BuildPaymentHeader;
}

/**
 * Rail-dispatching one-call pay: XRP settles on XRPL, USDC on Algorand.
 *
 * A convenience front door over `payAliasXrp` / `payAliasUsdcAlgorand` — pass
 * the credentials for the rail you're paying on. Dispatch is a currency table
 * lookup, deterministic by construction.
 */
export async function payAlias(options: PayAliasOptions): Promise<X402PaymentResult> {
  const cur = (options.currency ?? "XRP").toUpperCase();
  if (cur === "XRP") {
    if (!options.xrplSeed) throw new X402PayError("XRP payment requires xrplSeed");
    if (options.amount === undefined || options.amount === null) {
      throw new X402PayError("XRP payment requires amount (XRP endpoints are not price-quoted)");
    }
    return payAliasXrp({
      baseUrl: options.baseUrl,
      alias: options.alias,
      amountXrp: options.amount,
      seed: options.xrplSeed,
      apiKey: options.apiKey,
      xrplWssUrl: options.xrplWssUrl,
      signAndSubmit: options.signAndSubmit,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
  }
  if (cur === "USDC") {
    return payAliasUsdcAlgorand({
      baseUrl: options.baseUrl,
      alias: options.alias,
      apiKey: options.apiKey,
      amountUsdc: options.amount ?? undefined,
      mnemonic: options.algorandMnemonic,
      secretKey: options.algorandSecretKey,
      buildPaymentHeader: options.buildPaymentHeader,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
  }
  throw new X402PayError(
    `unsupported currency ${JSON.stringify(options.currency)} — this client pays XRP (XRPL) or USDC (Algorand)`,
  );
}
