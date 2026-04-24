// Low-level wrapper around the Xaman xApp <-> host postMessage protocol.
//
// Based on the open-source xAppBuilder preload
// (https://github.com/xrpl-labs/xapp/blob/master/app/work/preloadwebview.js),
// the xApp <-> Xaman bridge is pure `window.postMessage` — NOT an injected
// `window.xumm` object. The xApp sends JSON-encoded command envelopes and
// receives JSON-encoded method replies in the same way:
//
//   xApp  →  host : window.postMessage(JSON.stringify({ command, ...args }), "*")
//   host  →  xApp : window.postMessage(JSON.stringify({ method, ...data }), ...)
//
// The widely-referenced `xumm.min.js` CDN script is a SDK that wraps this
// protocol for convenience + browser-OAuth flows — but relying on it inside
// the WebView breaks because it only registers `window.Xumm` (capital) as an
// OAuth client, not an xApp SDK. Speaking the raw protocol ourselves gives
// us exactly what we need for the MVP and stays robust across Xaman versions.
//
// Non-negotiable #1 per xaman-xapp-frontend skill: this file is the ONLY
// place that touches the host bridge directly.

import type { SignRequestResult } from "./types";

/**
 * The set of commands the host (Xaman / xAppBuilder) recognises when we
 * post a message. Keep this in sync with xAppBuilder's preloadwebview.js.
 */
type XappCommand =
  | "ready"
  | "close"
  | "openSignRequest"
  | "scanQr"
  | "openBrowser"
  | "selectDestination"
  | "share"
  | "txDetails"
  | "xAppNavigate"
  | "networkSwitch";

type HostReply =
  | { method: "ready" }
  | { method: "close" }
  | ({ method: "openSignRequest" } & SignRequestResult)
  | { method: "scanQr"; reason?: string; qrContents?: string }
  | { method: string; [key: string]: unknown };

type ReplyHandler = (reply: HostReply) => void;

// Replies from Xaman come keyed by `method` name — there is no correlation
// id in the protocol, so we queue handlers per-method FIFO. A single xApp
// session rarely has two in-flight requests of the same method, so this is
// safe in practice.
const replyQueue = new Map<string, ReplyHandler[]>();

let bridgeInitialized = false;

function initBridge(): void {
  if (bridgeInitialized || typeof window === "undefined") return;
  window.addEventListener("message", (ev) => {
    // Xaman / xAppBuilder post JSON strings. Anything else is not ours.
    if (typeof ev.data !== "string") return;
    let parsed: HostReply;
    try {
      parsed = JSON.parse(ev.data) as HostReply;
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object" || !("method" in parsed)) return;

    const handlers = replyQueue.get(parsed.method);
    if (!handlers || handlers.length === 0) return;
    const handler = handlers.shift()!;
    handler(parsed);
  });
  bridgeInitialized = true;
}

function waitForReply(method: string, timeoutMs = 0): Promise<HostReply> {
  initBridge();
  return new Promise((resolve, reject) => {
    const handlers = replyQueue.get(method) ?? [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler: ReplyHandler = (reply) => {
      if (timer) clearTimeout(timer);
      resolve(reply);
    };
    handlers.push(handler);
    replyQueue.set(method, handlers);

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        const current = replyQueue.get(method) ?? [];
        const idx = current.indexOf(handler);
        if (idx >= 0) current.splice(idx, 1);
        reject(new Error(`Timed out waiting for Xaman "${method}" reply`));
      }, timeoutMs);
    }
  });
}

function sendCommand(
  command: XappCommand,
  args: Record<string, unknown> = {},
): void {
  initBridge();
  if (typeof window === "undefined") return;
  // Xaman / xAppBuilder accepts a JSON string as the postMessage data.
  window.postMessage(JSON.stringify({ command, ...args }), "*");
}

/**
 * Parses the boot query params Xaman passes when launching the xApp.
 * - xAppToken: the OTT (one-time token), UUID format
 * - xAppStyle: LIGHT / DARK / MOONLIGHT / ROYAL
 * - xAppVersion: Xaman app version
 */
export function parseBootParams(): {
  xAppToken: string | null;
  xAppStyle: string | null;
  xAppVersion: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    xAppToken: params.get("xAppToken"),
    xAppStyle: params.get("xAppStyle"),
    xAppVersion: params.get("xAppVersion"),
  };
}

/**
 * Gives the host WebView bridge a brief tick to wire up message listeners
 * before we start posting. In the old `window.xumm` SDK model this was
 * awaiting the SDK's own ready Promise; with the raw postMessage protocol
 * there is nothing to wait for (both sides are listener-based), but we keep
 * a small delay so event handlers attached elsewhere in the app are up
 * before the first boot message round-trip.
 */
export async function waitForReady(): Promise<void> {
  initBridge();
  await new Promise((r) => setTimeout(r, 50));
}

/**
 * Tells Xaman the xApp has booted and the native loader should dismiss.
 * When the "Xaman Loader Screen" setting is enabled in apps.xaman.dev,
 * Xaman keeps its own spinner up until this message arrives. Must be
 * called once the xApp is in a state worth showing (successful session
 * OR a displayable error) — never swallow the ready signal.
 *
 * Fire-and-forget: Xaman replies with `{ method: "ready" }` but we don't
 * need to act on that. If the host doesn't reply within 2s we still
 * resolve — the loader dismiss is best-effort and UI state is already
 * in a render-worthy shape by the time this is called.
 */
export async function signalReady(): Promise<void> {
  const ack = waitForReply("ready", 2000).catch(() => null);
  sendCommand("ready");
  await ack;
}

/**
 * Closes the xApp WebView. Xaman tears down the native container and
 * optionally refreshes any subscribed events before returning to the
 * wallet's main surface.
 */
export async function closeXapp(
  opts: { refreshEvents?: boolean } = {},
): Promise<void> {
  sendCommand("close", opts);
  // Best-effort wait for the host ack; Xaman tears down the WebView so we
  // may never actually see it.
  await waitForReply("close", 1500).catch(() => null);
}

/**
 * Opens a Xaman sign-request payload for the user to approve / reject.
 * The host replies with {method:"openSignRequest", signed, txid, ...}.
 */
export async function openSignRequest(
  payloadUuid: string,
): Promise<SignRequestResult> {
  const pending = waitForReply("openSignRequest");
  sendCommand("openSignRequest", { uuid: payloadUuid });
  const reply = (await pending) as { method: "openSignRequest" } & SignRequestResult;
  // Strip the `method` field — the rest is the SignRequestResult shape.
  const { method: _method, ...result } = reply;
  return result as SignRequestResult;
}
