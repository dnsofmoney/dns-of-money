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

import {
  A2ACapabilities,
  A2APaymentHookRequest,
  A2APaymentHookResponse,
  validatePaymentHookRequest,
} from "./schemas";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface ClientOptions {
  apiKey?: string;
  timeoutMs?: number;
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

  constructor(baseUrl: string, options: ClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Fetch the server's advertised A2A capabilities. */
  async capabilities(): Promise<A2ACapabilities> {
    return this.request<A2ACapabilities>("GET", "/v1/a2a/capabilities");
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
    return this.request<A2APaymentHookResponse>("POST", "/v1/a2a/payment-hook", body);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["X-API-Key"] = this.apiKey;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`A2A request failed (${resp.status} ${resp.statusText}): ${text}`);
      }
      return (await resp.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
