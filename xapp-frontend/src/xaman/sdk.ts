// Low-level wrapper around the official Xaman xApp SDK (`xumm-xapp-sdk`).
// This is the ONLY file in the codebase allowed to touch the SDK directly;
// every other consumer goes through useXaman() or the helpers below.
// Non-negotiable #1 per the xaman-xapp-frontend skill.
//
// Why the dedicated xApp SDK (not the universal CDN `xumm.min.js`, not a
// hand-rolled postMessage bridge):
//
//   • The CDN `xumm.min.js` only exposes `window.Xumm` — a *constructor* for
//     the OAuth2/Web3 SDK. It never auto-creates `window.xumm`, so any code
//     reading `window.xumm` always failed with "xumm SDK not loaded". That was
//     the real "window.xumm race".
//   • A previous revision then hand-rolled the raw postMessage protocol. It
//     posted the right `{command,...}` envelope, but skipped the timing logic
//     the real bridge needs: the host WebView only accepts commands after a
//     readiness gate + a minimum doc-alive window, and the bridge object
//     (ReactNativeWebView) may attach a few hundred ms late. Posting a sign
//     request immediately meant Xaman silently dropped it on devices where the
//     WebView wasn't ready yet — "worked on my phone, dead on the reviewer's".
//
// `xumm-xapp-sdk` is purpose-built for running INSIDE the Xaman WebView: it
// needs no API key (auth is the OTT/host), it waits for readiness, enforces
// the min-alive stall, and retries the post — for iOS and Android (both are
// React Native, so `ReactNativeWebView` is the bridge on both) and for the
// xAppBuilder iframe. We bundle it via npm so there is no extra CDN origin to
// allow-list and the version is pinned.

import { xApp } from "xumm-xapp-sdk";
import type { SignRequestResult } from "./types";

// Did the Xaman SANDBOX proxy complete its handshake? The SDK posts
// "XAPP_PROXY_INIT" to window.parent on construction and only routes commands
// through the parent proxy AFTER the parent replies "XAPP_PROXY_INIT_ACK". For
// a sandboxed xApp that ACK is the difference between commands relaying and
// being silently dropped, so we watch for it independently and report it in
// boot telemetry. (Production/live xApps use ReactNativeWebView and never need
// this — proxyAck stays false there, which is fine.)
let proxyAckSeen = false;
function installProxyAckProbe(): void {
  if (typeof window === "undefined") return;
  const onMsg = (ev: MessageEvent): void => {
    if (ev && ev.data === "XAPP_PROXY_INIT_ACK") proxyAckSeen = true;
  };
  window.addEventListener("message", onMsg);
  // Android delivers host messages on document.
  document.addEventListener("message", onMsg as EventListener);
}

// Lazily constructed singleton. The constructor wires up the host message
// listeners, so we only build it once and on the client (never during SSR /
// the Vite build step).
let instance: xApp | null = null;
function sdk(): xApp {
  if (!instance) {
    // Install our ACK probe BEFORE constructing the SDK so we don't miss the
    // handshake reply that the SDK's own init triggers.
    installProxyAckProbe();
    instance = new xApp();
  }
  return instance;
}

// Post a command envelope directly to the host, preferring the channel that is
// PROVEN to open sign requests in this sandboxed xApp.
//
// History (from the payload log): on 2026-06-21 the hand-rolled bridge dispatched
// via `window.ReactNativeWebView.postMessage` and sign requests OPENED + SIGNED.
// After switching to the official SDK, the SDK — on a *sandboxed* xApp — routes
// commands to `window.parent` (its proxy) after an ACK handshake, and that path
// stopped surfacing the sheet (payloads created but never "Opened"). So for the
// actual dispatch we bypass the SDK's channel choice and hit ReactNativeWebView
// first (the real Xaman app, iOS + Android), falling back to the parent proxy
// only when there is no ReactNativeWebView (e.g. an iframe-only context). We
// still keep the SDK instance for its inbound `payload` event + diagnostics.
//
// The wire format matches the SDK's exactly: JSON `{command, ...args}`.
function postDirect(command: string, args: Record<string, unknown> = {}): boolean {
  if (typeof window === "undefined") return false;
  const msg = JSON.stringify({ command, ...args });
  const w = window as unknown as {
    ReactNativeWebView?: { postMessage?: (m: string) => void };
    parent?: { postMessage?: (m: string, targetOrigin: string) => void };
  };
  try {
    if (w.ReactNativeWebView?.postMessage) {
      w.ReactNativeWebView.postMessage(msg);
      return true;
    }
  } catch {
    /* fall through to the parent channel */
  }
  try {
    if (w.parent && w.parent !== window && w.parent.postMessage) {
      w.parent.postMessage(msg, "*");
      return true;
    }
  } catch {
    /* no channel available */
  }
  return false;
}

/**
 * Parses the boot query params Xaman passes when launching the xApp.
 * - xAppToken: the OTT (one-time token), UUID format
 * - xAppStyle: LIGHT / DARK / MOONLIGHT / ROYAL
 * - xAppVersion: Xaman app version
 *
 * (The SDK also exposes the OTT via getEnvironment(), but we read it from the
 * URL so the backend exchange stays independent of SDK boot order.)
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
 * Constructs the SDK (attaching its host listeners) so it's ready before any
 * UI that depends on the session renders. The SDK manages its own per-command
 * readiness/retry, so there's nothing to await here beyond instantiation;
 * mounting session-dependent UI still waits on the OTT exchange in the
 * provider. Never throws — outside a host the listeners simply never fire.
 */
export async function waitForReady(): Promise<void> {
  if (typeof window === "undefined") return;
  sdk();
}

/**
 * Tells Xaman the xApp has booted so it dismisses its native loader screen.
 * Best-effort: outside a host this is a no-op and never throws.
 */
export async function signalReady(): Promise<void> {
  if (typeof window === "undefined") return;
  sdk(); // ensure the inbound listener + proxy-ACK probe are installed
  // Dismiss the native loader over the proven channel (not the SDK's sandbox
  // proxy path). Best-effort — outside a host this simply no-ops.
  postDirect("ready");
}

/**
 * Closes the xApp WebView. Xaman tears down the native container and
 * optionally refreshes any subscribed events before returning to the wallet.
 */
export async function closeXapp(
  opts: { refreshEvents?: boolean } = {},
): Promise<void> {
  postDirect("close", opts);
}

/**
 * True when a Xaman host bridge is actually reachable from this WebView.
 *
 * The SDK can only deliver commands through `window.ReactNativeWebView` (the
 * real Xaman app, iOS + Android) or `window.parent` (the xAppBuilder iframe).
 * If neither exists the SDK burns 8 retries over ~2.3s and then RESOLVES an
 * Error — it does not throw — so an unchecked call looks like "nothing
 * happened". Callers use this to skip the SDK and fall back to a plain link.
 */
export function isXappHost(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { ReactNativeWebView?: unknown; parent?: unknown };
  return !!w.ReactNativeWebView || (!!w.parent && w.parent !== window);
}

/**
 * Snapshot of the host environment, for boot telemetry. Lets us see from the
 * server which bridge (if any) a given device actually exposed — the difference
 * between "worked on my phone" and "dead on the reviewer's".
 */
export function hostDiagnostics(): Record<string, string | boolean> {
  const w = window as unknown as { ReactNativeWebView?: unknown; parent?: unknown };
  let env: { version?: string; ott?: string } = {};
  try {
    env = sdk().getEnvironment() ?? {};
  } catch {
    /* ignore */
  }
  return {
    rnwv: !!w.ReactNativeWebView,
    iframe: !!w.parent && w.parent !== window,
    host: isXappHost(),
    // The single most important signal for a sandboxed xApp: did the parent
    // proxy ACK the handshake? If false in a sandbox, commands (sign/browser)
    // won't relay — this is what tells us WHY the reviewer sees nothing.
    proxyAck: proxyAckSeen,
    ott: !!env.ott,
    ver: env.version || "",
    ua: (navigator.userAgent || "").slice(0, 120),
  };
}

/**
 * Asks the Xaman host to open an external URL in the device browser. Used for
 * the MoonPay on-ramp hand-off, the hosted Terms / Privacy / Support pages, and
 * the sign-request deeplink.
 *
 * Returns TRUE only when the host acknowledged the command. On a missing bridge
 * the SDK resolves an Error after ~2.3s of retries, which we report as false so
 * the caller can fall back to a plain navigation instead of doing nothing.
 */
export async function openBrowser(url: string): Promise<boolean> {
  // Dispatch on the proven channel (ReactNativeWebView first), NOT the SDK's
  // sandbox parent-proxy path. Returns whether a host channel was available.
  return postDirect("openBrowser", { url });
}

/**
 * Opens a Xaman sign-request payload for the user to approve / reject, and
 * resolves once the host reports the outcome via the `payload` event.
 *
 * Note: the xApp `payload` event carries only { reason: SIGNED|DECLINED, uuid }
 * — there is NO txid here. Flows that need the on-ledger tx hash (register,
 * send) read it from the payload websocket (`websocket_status`) instead; this
 * promise is the authoritative signed/declined signal and also fires when the
 * user signs via the deeplink fallback. Never rejects on a normal outcome.
 */
export function openSignRequest(
  uuid: string,
  onDispatch?: (result: "ok" | "failed") => void,
): Promise<SignRequestResult> {
  // No bridge → the SDK would retry for ~2.3s and then quietly resolve an
  // Error. Reject now so the UI surfaces the deeplink fallback immediately.
  if (!isXappHost()) {
    onDispatch?.("failed");
    return Promise.reject(new Error("No Xaman host bridge — cannot open sign request"));
  }
  const s = sdk();
  return new Promise<SignRequestResult>((resolve, reject) => {
    const handler = (data: { reason: "SIGNED" | "DECLINED"; uuid: string }) => {
      // Ignore resolutions for any other in-flight payload. (The host delivers
      // the event on both window and document, so this fires twice — `off`
      // makes the second one a no-op.)
      if (data?.uuid && data.uuid !== uuid) return;
      s.off("payload", handler);
      resolve({
        signed: data?.reason === "SIGNED",
        payload_uuidv4: data?.uuid ?? uuid,
        reason: data?.reason,
      });
    };
    // Keep the SDK's inbound listener for the resolution event (payloadResolved),
    // which fires regardless of how the command was dispatched…
    s.on("payload", handler);

    // …but DISPATCH via the proven ReactNativeWebView channel, not the SDK's
    // sandbox parent-proxy path that failed to open the sheet. If no host
    // channel exists, reject now so the UI surfaces the deeplink fallback.
    const sent = postDirect("openSignRequest", { uuid });
    onDispatch?.(sent ? "ok" : "failed");
    if (!sent) {
      s.off("payload", handler);
      reject(new Error("No Xaman host channel to post the sign request"));
    }
  });
}
