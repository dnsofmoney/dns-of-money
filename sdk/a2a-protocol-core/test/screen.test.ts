/** Paid counterparty screen: challenge, settle, verdict extraction, fee rails. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchScreenRequirementHeader, screen, screenWithPaymentHeader } from "../src/screen";
import { X402PayError, invoiceIdHash } from "../src/x402Pay";
import { headerOf, jsonResponse, makeFetch, signedCredentialFixture } from "./helpers";

const B64 = (obj: unknown) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64");

const SCREEN_BODY = {
  idempotent: true,
  proof: { transaction: "TX9" },
  attestation: {
    credentialSubject: { screen: { verdict: "CLEAR", payee: { verdict: "CLEAR" } } },
    proof: { proofValue: "zsig" },
  },
};

test("fetchScreenRequirementHeader returns the raw 402 header (server-priced — no amount param)", async () => {
  const fake = makeFetch(jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAW" }));
  const raw = await fetchScreenRequirementHeader({
    baseUrl: "https://api.test",
    target: "pay:vendor.alpha",
    fetchImpl: fake.impl,
  });
  assert.equal(raw, "RAW");
  assert.equal(fake.calls[0].url, "https://api.test/api/v1/x402/screen/pay:vendor.alpha?currency=USDC");
});

test("fetchScreenRequirementHeader rejects a non-402 answer", async () => {
  const fake = makeFetch(jsonResponse(200, {}));
  await assert.rejects(
    fetchScreenRequirementHeader({ baseUrl: "https://api.test", target: "pay:a", fetchImpl: fake.impl }),
    /expected a 402/,
  );
});

test("screenWithPaymentHeader settles and reads the verdict from the signed VC form", async () => {
  const fake = makeFetch(jsonResponse(200, SCREEN_BODY));
  const result = await screenWithPaymentHeader({
    baseUrl: "https://api.test",
    target: "pay:vendor.alpha",
    paymentHeader: "PH",
    apiKey: "k1",
    fetchImpl: fake.impl,
  });
  assert.equal(result.verdict, "CLEAR");
  assert.equal(result.target, "pay:vendor.alpha");
  assert.equal(result.idempotent, true);
  assert.equal(result.summary.signed, true);
  assert.equal(result.verification, undefined);
  assert.equal(headerOf(fake.calls[0], "X-PAYMENT"), "PH");
  assert.equal(headerOf(fake.calls[0], "X-API-Key"), "k1");
});

test("screenWithPaymentHeader reads the unsigned flat form", async () => {
  const fake = makeFetch(
    jsonResponse(200, { idempotent: false, attestation: { screen: { verdict: "BLOCKED" } } }),
  );
  const result = await screenWithPaymentHeader({
    baseUrl: "https://api.test",
    target: "0xdeadbeef",
    paymentHeader: "PH",
    apiKey: "k1",
    fetchImpl: fake.impl,
  });
  assert.equal(result.verdict, "BLOCKED");
  assert.equal(result.summary.signed, false);
});

test("screenWithPaymentHeader surfaces a settle failure", async () => {
  const fake = makeFetch(jsonResponse(402, { detail: "no payment" }));
  await assert.rejects(
    screenWithPaymentHeader({
      baseUrl: "https://api.test",
      target: "pay:a",
      paymentHeader: "PH",
      apiKey: "k1",
      fetchImpl: fake.impl,
    }),
    (err: unknown) => err instanceof X402PayError && /screen settle failed 402/.test(err.message),
  );
});

test("screenWithPaymentHeader verify:true checks the proof against a pinned DID document", async () => {
  const fixture = signedCredentialFixture();
  const fake = makeFetch(
    jsonResponse(200, { idempotent: false, attestation: fixture.attestation, proof: {} }),
  );
  const result = await screenWithPaymentHeader({
    baseUrl: "https://api.test",
    target: "pay:a",
    paymentHeader: "PH",
    apiKey: "k1",
    verify: true,
    didDocument: fixture.didDocument,
    fetchImpl: fake.impl,
  });
  assert.equal(result.verification?.verified, true);
  assert.equal(result.verification?.issuer, fixture.issuer);
});

test("screenWithPaymentHeader verify:true FAILS on an unsigned attestation", async () => {
  const fake = makeFetch(
    jsonResponse(200, { idempotent: false, attestation: { screen: { verdict: "CLEAR" } } }),
  );
  await assert.rejects(
    screenWithPaymentHeader({
      baseUrl: "https://api.test",
      target: "pay:a",
      paymentHeader: "PH",
      apiKey: "k1",
      verify: true,
      fetchImpl: fake.impl,
    }),
    /unsigned/,
  );
});

test("screen (USDC) pays the fee via the injected header builder", async () => {
  const fake = makeFetch(
    jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAWUSDC" }),
    jsonResponse(200, SCREEN_BODY),
  );
  const built: string[] = [];
  const result = await screen({
    baseUrl: "https://api.test",
    target: "pay:vendor.alpha",
    apiKey: "k1",
    fetchImpl: fake.impl,
    buildPaymentHeader: (raw) => {
      built.push(raw);
      return "AVM-H";
    },
  });
  assert.equal(result.verdict, "CLEAR");
  assert.deepEqual(built, ["RAWUSDC"]);
  assert.equal(headerOf(fake.calls[1], "X-PAYMENT"), "AVM-H");
});

test("screen (XRP) signs the fee with the extra-block InvoiceID binding", async () => {
  const requirement = {
    payTo: "rFee1",
    maxAmountRequired: "10000",
    extra: { invoiceId: "inv-screen", sourceTag: 3 },
  };
  const fake = makeFetch(
    jsonResponse(402, {}, { "PAYMENT-REQUIRED": B64(requirement) }),
    jsonResponse(200, SCREEN_BODY),
  );
  const signedWith: Record<string, unknown>[] = [];
  const result = await screen({
    baseUrl: "https://api.test",
    target: "pay:vendor.alpha",
    apiKey: "k1",
    currency: "XRP",
    xrplSeed: "sSEED",
    fetchImpl: fake.impl,
    signAndSubmit: async (args) => {
      signedWith.push(args as unknown as Record<string, unknown>);
      return { txHash: "TXFEE", payer: "rMe" };
    },
  });
  assert.equal(result.verdict, "CLEAR");
  assert.equal(signedWith[0].invoiceId, invoiceIdHash("inv-screen"));
  assert.equal(signedWith[0].sourceTag, 3);
  const xPayment = headerOf(fake.calls[1], "X-PAYMENT");
  assert.deepEqual(JSON.parse(Buffer.from(xPayment!, "base64").toString("utf8")).payload, {
    txHash: "TXFEE",
    payer: "rMe",
  });
});

test("screen (XRP) without a seed or injected signer is rejected", async () => {
  const fake = makeFetch(jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAW" }));
  await assert.rejects(
    screen({ baseUrl: "https://api.test", target: "pay:a", apiKey: "k", currency: "XRP", fetchImpl: fake.impl }),
    /requires xrplSeed/,
  );
});

test("screen rejects an unsupported fee currency", async () => {
  const fake = makeFetch(jsonResponse(402, {}, { "PAYMENT-REQUIRED": "RAW" }));
  await assert.rejects(
    screen({ baseUrl: "https://api.test", target: "pay:a", apiKey: "k", currency: "EUR", fetchImpl: fake.impl }),
    /unsupported fee currency/,
  );
});
