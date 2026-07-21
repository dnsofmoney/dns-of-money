/**
 * Bounded, deterministic retry for idempotent HTTP legs — TS mirror of the
 * Python `_retry`.
 *
 * Agent runtimes call these endpoints over flaky networks; a transient
 * connection reset or a 502 from a proxy should not fail a whole pay/screen
 * flow. Retries are DELIBERATELY narrow:
 *
 * - GET only, and only legs that are idempotent by contract. The x402 settle
 *   leg qualifies: the server checks idempotency BEFORE verification, so
 *   re-sending the same settled tx proof returns the recorded outcome rather
 *   than double-settling.
 * - Network errors / timeouts and 502/503/504 only. A 4xx or a 500 is a real
 *   answer and is returned immediately — retrying it would just repeat it.
 * - Fixed attempt count, exponential backoff, no jitter — deterministic, like
 *   everything else in this package.
 */

export const RETRYABLE_STATUS: ReadonlySet<number> = new Set([502, 503, 504]);
export const DEFAULT_RETRIES = 2; // total attempts = retries + 1
export const DEFAULT_BACKOFF_MS = 500; // doubles per attempt

export interface GetWithRetriesOptions {
  params?: Record<string, string>;
  headers?: Record<string, string>;
  timeoutMs: number;
  retries?: number;
  backoffMs?: number;
  /** Injectable fetch (the Python `session` seam) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withParams(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return url;
  const qs = new URLSearchParams(params).toString();
  return `${url}${url.includes("?") ? "&" : "?"}${qs}`;
}

/** GET with bounded retries on transient failures (see module docstring). */
export async function getWithRetries(url: string, options: GetWithRetriesOptions): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const target = withParams(url, options.params);
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    let resp: Response;
    try {
      resp = await fetchImpl(target, { method: "GET", headers: options.headers, signal: controller.signal });
    } catch (err) {
      // fetch rejects on network failure; an aborted signal is our timeout.
      if (attempt >= retries) throw err;
      await sleep(backoffMs * 2 ** attempt);
      attempt += 1;
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (RETRYABLE_STATUS.has(resp.status) && attempt < retries) {
      await sleep(backoffMs * 2 ** attempt);
      attempt += 1;
      continue;
    }
    return resp;
  }
}
