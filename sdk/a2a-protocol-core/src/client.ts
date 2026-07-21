/**
 * A2A-041 Payment Hook client — TS mirror of the Python `client`.
 *
 * A thin client over the DNS of Money A2A surface. Intelligence lives in the
 * *calling* agent; this client only carries a well-formed, validated request to
 * the deterministic core and parses the response. Uses the built-in `fetch` —
 * no runtime dependencies.
 *
 *   import { A2APaymentHookClient } from "@dnsofmoney/a2a-protocol-core";
 *
 *   const client = new A2APaymentHookClient("https://api.dnsofmoney.com");
 *   const res = await client.trigger({
 *     jobId: "job-123",
 *     providerPayAddress: "pay:agent.compute",
 *     requesterPayAddress: "pay:vendor.alpha",
 *     amount: "2.50",
 *     semanticHash: "abc123...",
 *   });
 *   console.log(res.settlement_result.status, res.iso_message_ref);
 */

import { getWithRetries } from "./_retry";
import {
  A2ACapabilities,
  A2APaymentHookRequest,
  A2APaymentHookResponse,
  validatePaymentHookRequest,
} from "./schemas";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * HTTP-level failure from the A2A surface, with response context attached.
 *
 * Carries `statusCode` and a `body` snippet so an agent can branch on the
 * failure (409 duplicate job vs 422 validation vs 5xx) instead of parsing a
 * bare error string.
 */
export class A2AClientError extends Error {
  readonly statusCode?: number;
  readonly body?: string;

  constructor(message: string, options: { statusCode?: number; body?: string } = {}) {
    super(message);
    this.name = "A2AClientError";
    this.statusCode = options.statusCode;
    this.body = options.body;
  }
}

export interface ClientOptions {
  apiKey?: string;
  timeoutMs?: number;
  /** Injectable fetch (the Python `session` seam) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface TriggerParams {
  jobId: string;
  providerPayAddress: string;
  requesterPayAddress: string;
  amount: string | number;
  semanticHash: string;
  currency?: string;
  receiptRef?: string;
  /** Already-submitted XRPL tx hash for live settlement (verified server-side). */
  settlementTxHash?: string;
}

export class A2APaymentHookClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl?: typeof fetch;

  constructor(baseUrl: string, options: ClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl;
  }

  /** Fetch the server's advertised A2A capabilities (idempotent — retried). */
  async capabilities(): Promise<A2ACapabilities> {
    const resp = await getWithRetries(`${this.baseUrl}/v1/a2a/capabilities`, {
      headers: this.headers(),
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
    });
    if (resp.status !== 200) {
      const text = await resp.text().catch(() => "");
      throw new A2AClientError(`capabilities failed ${resp.status}: ${text.slice(0, 300)}`, {
        statusCode: resp.status,
        body: text.slice(0, 300),
      });
    }
    return (await resp.json()) as A2ACapabilities;
  }

  /**
   * Fire the A2A-041 payment hook. The request is validated client-side (pay:
   * URI grammar, non-empty semantic hash) before it hits the wire.
   */
  async trigger(params: TriggerParams): Promise<A2APaymentHookResponse> {
    const body: A2APaymentHookRequest = {
      job_id: params.jobId,
      provider_pay_address: params.providerPayAddress,
      requester_pay_address: params.requesterPayAddress,
      amount: String(params.amount),
      currency: params.currency ?? "USD",
      semantic_hash: params.semanticHash,
      receipt_ref: params.receiptRef ?? null,
      settlement_tx_hash: params.settlementTxHash ?? null,
    };
    validatePaymentHookRequest(body);
    // POST is sent exactly once — it triggers settlement, so the client never
    // auto-retries it. On a transient failure, re-send with the SAME jobId +
    // semanticHash: the server derives its idempotency key from that pair, so
    // a duplicate returns the stored outcome instead of settling twice.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const fetchImpl = this.fetchImpl ?? fetch;
      const resp = await fetchImpl(`${this.baseUrl}/v1/a2a/payment-hook`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (resp.status >= 400) {
        const text = await resp.text().catch(() => "");
        throw new A2AClientError(`payment hook failed ${resp.status}: ${text.slice(0, 300)}`, {
          statusCode: resp.status,
          body: text.slice(0, 300),
        });
      }
      return (await resp.json()) as A2APaymentHookResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["X-API-Key"] = this.apiKey;
    return h;
  }
}
