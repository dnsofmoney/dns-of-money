/** Bounded-retry contract: narrow triggers, deterministic backoff, no surprises. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { getWithRetries } from "../src/_retry";
import { jsonResponse, makeFetch } from "./helpers";

const FAST = { timeoutMs: 5_000, backoffMs: 0 };

test("returns the first response when it is not retryable", async () => {
  const fake = makeFetch(jsonResponse(200, { ok: true }));
  const resp = await getWithRetries("https://api.test/x", { ...FAST, fetchImpl: fake.impl });
  assert.equal(resp.status, 200);
  assert.equal(fake.calls.length, 1);
});

test("retries 503 then succeeds", async () => {
  const fake = makeFetch(jsonResponse(503, {}), jsonResponse(503, {}), jsonResponse(200, { ok: true }));
  const resp = await getWithRetries("https://api.test/x", { ...FAST, fetchImpl: fake.impl });
  assert.equal(resp.status, 200);
  assert.equal(fake.calls.length, 3);
});

test("returns the retryable status once attempts are exhausted (caller decides)", async () => {
  const fake = makeFetch(jsonResponse(502, {}), jsonResponse(502, {}), jsonResponse(502, {}));
  const resp = await getWithRetries("https://api.test/x", { ...FAST, fetchImpl: fake.impl });
  assert.equal(resp.status, 502);
  assert.equal(fake.calls.length, 3); // retries=2 → 3 attempts
});

test("does NOT retry a 4xx or a 500 — those are real answers", async () => {
  for (const status of [400, 404, 409, 422, 500]) {
    const fake = makeFetch(jsonResponse(status, {}));
    const resp = await getWithRetries("https://api.test/x", { ...FAST, fetchImpl: fake.impl });
    assert.equal(resp.status, status);
    assert.equal(fake.calls.length, 1, `status ${status} must not be retried`);
  }
});

test("retries a network error then succeeds", async () => {
  const fake = makeFetch(new Error("ECONNRESET"), jsonResponse(200, { ok: true }));
  const resp = await getWithRetries("https://api.test/x", { ...FAST, fetchImpl: fake.impl });
  assert.equal(resp.status, 200);
  assert.equal(fake.calls.length, 2);
});

test("throws once network errors exhaust the attempt budget", async () => {
  const fake = makeFetch(new Error("boom"), new Error("boom"), new Error("boom"));
  await assert.rejects(
    getWithRetries("https://api.test/x", { ...FAST, fetchImpl: fake.impl }),
    /boom/,
  );
  assert.equal(fake.calls.length, 3);
});

test("retries=0 means exactly one attempt", async () => {
  const fake = makeFetch(jsonResponse(503, {}));
  const resp = await getWithRetries("https://api.test/x", { ...FAST, retries: 0, fetchImpl: fake.impl });
  assert.equal(resp.status, 503);
  assert.equal(fake.calls.length, 1);
});

test("params are appended as a query string; headers pass through", async () => {
  const fake = makeFetch(jsonResponse(200, {}));
  await getWithRetries("https://api.test/pay/pay:a", {
    ...FAST,
    params: { amount: "0.01", currency: "USDC" },
    headers: { "X-API-Key": "k1" },
    fetchImpl: fake.impl,
  });
  assert.equal(fake.calls[0].url, "https://api.test/pay/pay:a?amount=0.01&currency=USDC");
  assert.equal((fake.calls[0].init?.headers as Record<string, string>)["X-API-Key"], "k1");
});
