/** x402 pay-path: pure helpers, challenge/settle legs, and rail dispatch. */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  X402PayError,
  attestSettledPayment,
  buildXPaymentHeader,
  decodePaymentRequired,
  fetchRequirement,
  fetchRequirementHeader,
  invoiceFieldsFromRequirement,
  invoiceIdHash,
  payAlias,
  payAliasUsdcAlgorand,
  payAliasXrp,
  summarizeAttestation,
} from "../src/x402Pay";
import { headerOf, jsonResponse, makeFetch } from "./helpers";

const B64 = (obj: unknown) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64");

const XRP_REQUIREMENT = {
  scheme: "exact",
  network: "xrpl:mainnet",
  payTo: "rDest123",
  maxAmountRequired: "100000",
  extra: { invoiceId: "inv-42", sourceTag: 7 },
};

const SETTLE_BODY = {
  settled: true,
  idempotent: false,
  proof: { transaction: "TXHASH1", payer: "rPayer1" },
  attestation: {
    credentialSubject: {
      screen: { verdict: "CLEAR", payee: { verdict: "CLEAR" }, payer: { verdict: "REVIEW" } },
      settlement: { txid: "TXHASH1" },
    },
    proof: { proofValue: "z123" },
  },
};

// ── Pure helpers ─────────────────────────────────────────────────────────────────

test("decodePaymentRequired round-trips base64(JSON)", () => {
  assert.deepEqual(decodePaymentRequired(B64(XRP_REQUIREMENT)), XRP_REQUIREMENT);
});

test("buildXPaymentHeader encodes the v2 envelope", () => {
  const decoded = JSON.parse(Buffer.from(buildXPaymentHeader("ABC", "rPayer"), "base64").toString("utf8"));
  assert.deepEqual(decoded, { x402Version: 2, payload: { txHash: "ABC", payer: "rPayer" } });
});

test("buildXPaymentHeader omits payer when absent", () => {
  const decoded = JSON.parse(Buffer.from(buildXPaymentHeader("ABC"), "base64").toString("utf8"));
  assert.deepEqual(decoded, { x402Version: 2, payload: { txHash: "ABC" } });
});

test("invoiceIdHash matches the server verifier (sha256, hex, uppercased)", () => {
  assert.equal(invoiceIdHash("abc"), "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD");
});

test("invoiceFieldsFromRequirement prefers the extra block (the XRPL exact scheme placement)", () => {
  const fields = invoiceFieldsFromRequirement({
    invoiceId: "top-level-old",
    sourceTag: 1,
    extra: { invoiceId: "extra-new", sourceTag: 2 },
  });
  assert.deepEqual(fields, { invoiceId: "extra-new", sourceTag: 2 });
});

test("invoiceFieldsFromRequirement falls back to deprecated top-level mirrors", () => {
  assert.deepEqual(invoiceFieldsFromRequirement({ invoiceId: "top", sourceTag: 9 }), {
    invoiceId: "top",
    sourceTag: 9,
  });
});

test("invoiceFieldsFromRequirement keeps a sourceTag of 0 from extra", () => {
  const fields = invoiceFieldsFromRequirement({ sourceTag: 5, extra: { sourceTag: 0 } });
  assert.equal(fields.sourceTag, 0);
});

test("invoiceFieldsFromRequirement returns undefineds when nothing is present", () => {
  assert.deepEqual(invoiceFieldsFromRequirement({}), { invoiceId: undefined, sourceTag: undefined });
});

test("summarizeAttestation reads the signed VC form", () => {
  const s = summarizeAttestation(SETTLE_BODY.attestation as Record<string, unknown>);
  assert.equal(s.verdict, "CLEAR");
  assert.equal(s.payeeVerdict, "CLEAR");
  assert.equal(s.payerVerdict, "REVIEW");
  assert.equal(s.txId, "TXHASH1");
  assert.equal(s.signed, true);
});

test("summarizeAttestation reads the unsigned flat form", () => {
  const s = summarizeAttestation({ screen: { verdict: "BLOCKED" }, settlement: { txid: "T2" } });
  assert.equal(s.verdict, "BLOCKED");
  assert.equal(s.txId, "T2");
  assert.equal(s.signed, false);
});

// ── Challenge legs ───────────────────────────────────────────────────────────────

test("fetchRequirement decodes the 402 challenge", async () => {
  const fake = makeFetch(jsonResponse(402, {}, { "PAYMENT-REQUIRED": B64(XRP_REQUIREMENT) }));
  const req = await fetchRequirement({ baseUrl: "https://api.test/", alias: "pay:a", amountXrp: "0.1", fetchImpl: fake.impl });
  assert.deepEqual(req, XRP_REQUIREMENT);
  assert.equal(fake.calls[0].url, "https://api.test/api/v1/x402/pay/pay:a?amount=0.1&currency=XRP");
});

test("fetchRequirement rejects a non-402 answer", async () => {
  const fake = makeFetch(jsonResponse(200, { nope: true }));
  await assert.rejects(
    fetchRequirement({ baseUrl: "https://api.test", alias: "pay:a", amountXrp: 1, fetchImpl: fake.impl }),
    (err: unknown) => err instanceof X402PayError && /expected a 402/.test(err.message),
  );
});

test("fetchRequirement rejects a 402 without the PAYMENT-REQUIRED header", async () => {
  const fake = makeFetch(jsonResponse(402, {}));
  await assert.rejects(
    fetchRequirement({ baseUrl: "https://api.test", alias: "pay:a", amountXrp: 1, fetchImpl: fake.impl }),
    /missing the PAYMENT-REQUIRED header/,
  );
});

test("fetchRequirementHeader returns the raw header and omits amount when unset (price-quoted)", async () => {
  const fake = makeFetch(jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAWHEADER" }));
  const raw = await fetchRequirementHeader({ baseUrl: "https://api.test", alias: "pay:a", fetchImpl: fake.impl });
  assert.equal(raw, "RAWHEADER");
  assert.equal(fake.calls[0].url, "https://api.test/api/v1/x402/pay/pay:a?currency=USDC");
});

// ── Settle legs ──────────────────────────────────────────────────────────────────

test("attestSettledPayment settles a bring-your-own tx and parses the result", async () => {
  const fake = makeFetch(jsonResponse(200, SETTLE_BODY));
  const result = await attestSettledPayment({
    baseUrl: "https://api.test",
    alias: "pay:a",
    amountXrp: "0.1",
    txHash: "TXHASH1",
    payer: "rPayer1",
    apiKey: "k1",
    fetchImpl: fake.impl,
  });
  assert.equal(result.txHash, "TXHASH1");
  assert.equal(result.payer, "rPayer1");
  assert.equal(result.settled, true);
  assert.equal(result.idempotent, false);
  assert.equal(result.summary.verdict, "CLEAR");
  const xPayment = headerOf(fake.calls[0], "X-PAYMENT");
  assert.ok(xPayment);
  assert.deepEqual(JSON.parse(Buffer.from(xPayment!, "base64").toString("utf8")).payload, {
    txHash: "TXHASH1",
    payer: "rPayer1",
  });
  assert.equal(headerOf(fake.calls[0], "X-API-Key"), "k1");
});

test("attestSettledPayment surfaces a settle failure with the body snippet", async () => {
  const fake = makeFetch(jsonResponse(403, { detail: "bad key" }));
  await assert.rejects(
    attestSettledPayment({
      baseUrl: "https://api.test",
      alias: "pay:a",
      amountXrp: 1,
      txHash: "T",
      apiKey: "k",
      fetchImpl: fake.impl,
    }),
    (err: unknown) => err instanceof X402PayError && /settle leg failed 403/.test(err.message) && /bad key/.test(err.message),
  );
});

// ── payAliasXrp with an injected signer (the bring-your-own-wallet seam) ─────────

test("payAliasXrp binds the InvoiceID from the extra block and settles", async () => {
  const fake = makeFetch(
    jsonResponse(402, {}, { "PAYMENT-REQUIRED": B64(XRP_REQUIREMENT) }),
    jsonResponse(200, SETTLE_BODY),
  );
  const signedWith: Record<string, unknown>[] = [];
  const result = await payAliasXrp({
    baseUrl: "https://api.test",
    alias: "pay:a",
    amountXrp: "0.1",
    seed: "sSEED",
    apiKey: "k1",
    fetchImpl: fake.impl,
    signAndSubmit: async (args) => {
      signedWith.push(args as unknown as Record<string, unknown>);
      return { txHash: "TXHASH1", payer: "rPayer1" };
    },
  });
  assert.equal(result.txHash, "TXHASH1");
  assert.equal(signedWith.length, 1);
  assert.equal(signedWith[0].payTo, "rDest123");
  assert.equal(signedWith[0].drops, "100000");
  assert.equal(signedWith[0].invoiceId, invoiceIdHash("inv-42")); // extra block wins
  assert.equal(signedWith[0].sourceTag, 7);
  assert.equal(fake.calls.length, 2);
});

// ── Rail dispatch ────────────────────────────────────────────────────────────────

test("payAlias rejects XRP without a seed", async () => {
  await assert.rejects(
    payAlias({ baseUrl: "https://api.test", alias: "pay:a", apiKey: "k", amount: 1, currency: "XRP" }),
    /requires xrplSeed/,
  );
});

test("payAlias rejects XRP without an amount (XRP endpoints are not price-quoted)", async () => {
  await assert.rejects(
    payAlias({ baseUrl: "https://api.test", alias: "pay:a", apiKey: "k", currency: "XRP", xrplSeed: "s" }),
    /requires amount/,
  );
});

test("payAlias rejects an unsupported currency", async () => {
  await assert.rejects(
    payAlias({ baseUrl: "https://api.test", alias: "pay:a", apiKey: "k", currency: "EUR" }),
    /unsupported currency/,
  );
});

test("payAlias USDC omits the amount to accept the enforced price", async () => {
  const fake = makeFetch(
    jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAWUSDC" }),
    jsonResponse(200, SETTLE_BODY),
  );
  const built: string[] = [];
  const result = await payAlias({
    baseUrl: "https://api.test",
    alias: "pay:dnsofmoney",
    apiKey: "k1",
    currency: "USDC",
    fetchImpl: fake.impl,
    buildPaymentHeader: (raw) => {
      built.push(raw);
      return "AVM-HEADER";
    },
  });
  assert.equal(result.settled, true);
  assert.deepEqual(built, ["RAWUSDC"]);
  assert.equal(fake.calls[0].url, "https://api.test/api/v1/x402/pay/pay:dnsofmoney?currency=USDC");
  assert.equal(fake.calls[1].url, "https://api.test/api/v1/x402/pay/pay:dnsofmoney?currency=USDC");
  assert.equal(headerOf(fake.calls[1], "X-PAYMENT"), "AVM-HEADER");
  assert.equal(headerOf(fake.calls[1], "X-API-Key"), "k1");
});

test("payAliasUsdcAlgorand passes a named amount through both legs", async () => {
  const fake = makeFetch(
    jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAWUSDC" }),
    jsonResponse(200, SETTLE_BODY),
  );
  await payAliasUsdcAlgorand({
    baseUrl: "https://api.test",
    alias: "pay:a",
    apiKey: "k1",
    amountUsdc: "0.05",
    fetchImpl: fake.impl,
    buildPaymentHeader: () => "H",
  });
  assert.equal(fake.calls[0].url, "https://api.test/api/v1/x402/pay/pay:a?currency=USDC&amount=0.05");
  assert.equal(fake.calls[1].url, "https://api.test/api/v1/x402/pay/pay:a?currency=USDC&amount=0.05");
});

test("payAliasUsdcAlgorand without wallet deps installed raises the install hint", async () => {
  const fake = makeFetch(jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAWUSDC" }));
  await assert.rejects(
    payAliasUsdcAlgorand({
      baseUrl: "https://api.test",
      alias: "pay:a",
      apiKey: "k1",
      mnemonic: "m ".repeat(25).trim(),
      fetchImpl: fake.impl,
    }),
    /optional peer dependencies/,
  );
});
