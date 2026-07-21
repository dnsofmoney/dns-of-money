/** Payment-hook client: typed errors, retried capabilities, unretried POST. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { A2AClientError, A2APaymentHookClient } from "../src/client";
import { jsonResponse, makeFetch } from "./helpers";

const CAPABILITIES = { binding_version: "1.0", supported_schemes: ["exact"], protocol_versions: ["A2A-041"] };

const HOOK_RESPONSE = {
  hook_id: "h1",
  job_id: "job-1",
  resolution: { provider_address: "rX", rail: "XRPL", endpoint: null },
  settlement_result: { status: "settled", rail: "XRPL", tx_ref: "T1", amount: "2.50", currency: "USD" },
  iso_message_ref: "iso-1",
  created_at: "2026-07-20T00:00:00Z",
};

function triggerParams() {
  return {
    jobId: "job-1",
    providerPayAddress: "pay:agent.compute",
    requesterPayAddress: "pay:vendor.alpha",
    amount: "2.50",
    semanticHash: "abc123",
  };
}

test("capabilities parses the response and sends the API key", async () => {
  const fake = makeFetch(jsonResponse(200, CAPABILITIES));
  const client = new A2APaymentHookClient("https://api.test/", { apiKey: "k1", fetchImpl: fake.impl });
  const caps = await client.capabilities();
  assert.equal(caps.binding_version, "1.0");
  assert.equal(fake.calls[0].url, "https://api.test/v1/a2a/capabilities");
  assert.equal((fake.calls[0].init?.headers as Record<string, string>)["X-API-Key"], "k1");
});

test("capabilities retries a transient 503 (idempotent leg)", async () => {
  const fake = makeFetch(jsonResponse(503, {}), jsonResponse(200, CAPABILITIES));
  const client = new A2APaymentHookClient("https://api.test", { fetchImpl: fake.impl });
  const caps = await client.capabilities();
  assert.equal(caps.binding_version, "1.0");
  assert.equal(fake.calls.length, 2);
});

test("capabilities failure raises A2AClientError with statusCode and body", async () => {
  const fake = makeFetch(jsonResponse(500, { detail: "boom" }));
  const client = new A2APaymentHookClient("https://api.test", { fetchImpl: fake.impl });
  await assert.rejects(client.capabilities(), (err: unknown) => {
    assert.ok(err instanceof A2AClientError);
    assert.equal(err.statusCode, 500);
    assert.match(err.body ?? "", /boom/);
    return true;
  });
});

test("trigger posts the validated request and parses the response", async () => {
  const fake = makeFetch(jsonResponse(200, HOOK_RESPONSE));
  const client = new A2APaymentHookClient("https://api.test", { apiKey: "k1", fetchImpl: fake.impl });
  const res = await client.trigger(triggerParams());
  assert.equal(res.settlement_result.status, "settled");
  const sent = JSON.parse(String(fake.calls[0].init?.body));
  assert.equal(sent.job_id, "job-1");
  assert.equal(sent.provider_pay_address, "pay:agent.compute");
});

test("trigger failure raises A2AClientError an agent can branch on (409 vs 422)", async () => {
  const fake = makeFetch(jsonResponse(409, { detail: "duplicate job" }));
  const client = new A2APaymentHookClient("https://api.test", { fetchImpl: fake.impl });
  await assert.rejects(client.trigger(triggerParams()), (err: unknown) => {
    assert.ok(err instanceof A2AClientError);
    assert.equal(err.statusCode, 409);
    return true;
  });
});

test("trigger is NEVER auto-retried — it settles money", async () => {
  const fake = makeFetch(jsonResponse(503, {}));
  const client = new A2APaymentHookClient("https://api.test", { fetchImpl: fake.impl });
  await assert.rejects(client.trigger(triggerParams()), A2AClientError);
  assert.equal(fake.calls.length, 1);
});

test("client-side validation fails fast before anything hits the wire", async () => {
  const fake = makeFetch();
  const client = new A2APaymentHookClient("https://api.test", { fetchImpl: fake.impl });
  await assert.rejects(
    client.trigger({ ...triggerParams(), providerPayAddress: "not-a-pay-uri" }),
    /Invalid pay: URI/,
  );
  assert.equal(fake.calls.length, 0);
});
