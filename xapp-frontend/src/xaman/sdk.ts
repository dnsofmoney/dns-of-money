// Low-level wrapper around window.xumm — the official Xaman xApp SDK injected
// by the CDN <script src="https://xumm.app/assets/cdn/xumm.min.js"> in
// index.html. This is the ONLY file in the codebase allowed to touch
// window.xumm directly; every other consumer goes through useXaman() or
// imports the helpers below. Non-negotiable #1 per the xaman-xapp-frontend
// skill.
//
// History / why this matters: a previous revision replaced this SDK with a
// hand-rolled `window.postMessage` bridge ("speak the raw protocol"). Inside
// the real Xaman WebView that bridge never reaches the host — the JSON command
// envelopes it posted are not the channel Xaman listens on — so BOTH sign
// requests (openSignRequest) and external links (openBrowser) silently did
// nothing: no payload ever appeared in the Requests tab, and Terms/Privacy/
// Support never opened. The supported, audited path is the CDN SDK's
// `window.xumm.xapp.*` methods, which know the native bridge for both iOS
// (WKWebView) and Android. We use them directly here.

import type { SignRequestResult } from "./types";

declare global {
  interface Window {
    xumm?: XummSdk;
  }
}

interface XummSdk {
  on(
    event: "ready" | "destination" | "qr",
    handler: (...args: unknown[]) => void,
  ): void;
  ready: Promise<void>;
  environment: {
    jwt: Promise<string | undefined>;
    ott: Promise<Record<string, unknown> | undefined>;
    bearer: Promise<string | undefined>;
  };
  user: {
    account: Promise<string | undefined>;
  };
  xapp: {
    openSignRequest(opts: { uuid: string }): Promise<SignRequestResult>;
    close(opts?: { refreshEvents?: boolean }): Promise<void>;
    tx(opts: { tx: string }): Promise<void>;
    scanQr(): Promise<{ reason?: string; qrContents?: string }>;
    openBrowser(opts: { url: string }): Promise<void>;
    navigate(opts: { xApp: string; destination?: string }): Promise<void>;
    share(opts: { text?: string; url?: string }): Promise<void>;
  };
}

/**
 * Returns the injected Xaman SDK, or null when it isn't present (e.g. the
 * dev server opened in a plain browser outside Xaman / xAppBuilder, where the
 * CDN script does not instantiate window.xumm). Callers that must have the SDK
 * use getXumm(); fire-and-forget helpers degrade gracefully on null.
 */
function maybeXumm(): XummSdk | null {
  return typeof window !== "undefined" && window.xumm ? window.xumm : null;
}

/**
 * Returns the injected Xaman SDK. Throws if the <script> tag in index.html
 * didn't load / instantiate (typical cause: running outside Xaman or
 * xAppBuilder).
 */
export function getXumm(): XummSdk {
  const xumm = maybeXumm();
  if (!xumm) {
    throw new Error(
      'xumm SDK not loaded — check the <script src="https://xumm.app/assets/cdn/xumm.min.js"> ' +
        "tag in index.html, and confirm you're running inside Xaman or xAppBuilder.",
    );
  }
  return xumm;
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
 * Waits for the Xaman native bridge to finish injecting the SDK + OTT into
 * window.xumm. The CDN <script> in <head> runs and instantiates window.xumm
 * synchronously before this module-type bundle executes, but we briefly poll
 * to be robust against any boot-order jitter (this was the "window.xumm race"
 * an earlier revision tried to avoid by abandoning the SDK — the correct fix
 * is to await readiness, not to drop the SDK). Resolves as soon as the SDK's
 * own `ready` promise resolves. Mounting session-dependent UI before this
 * resolves is a bug — non-negotiable #5.
 */
export async function waitForReady(): Promise<void> {
  for (let i = 0; i < 100 && !maybeXumm(); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  const xumm = getXumm();
  await xumm.ready;
}

/**
 * Best-effort: ensure the SDK has booted so Xaman dismisses its native loader
 * screen. The CDN SDK signals readiness to the host itself once initialized;
 * we just await that here so a stuck loader never hides a render-worthy UI.
 * Never throws — outside Xaman this simply no-ops.
 */
export async function signalReady(): Promise<void> {
  const xumm = maybeXumm();
  if (!xumm) return;
  await xumm.ready.catch(() => {});
}

/**
 * Closes the xApp WebView. Xaman tears down the native container and
 * optionally refreshes any subscribed events before returning to the wallet.
 */
export async function closeXapp(
  opts: { refreshEvents?: boolean } = {},
): Promise<void> {
  await getXumm().xapp.close(opts);
}

/**
 * Opens an external URL in the device browser via the Xaman host. Used to hand
 * off to flows that must run outside the xApp WebView (MoonPay on-ramp) and to
 * open the hosted Terms / Privacy / Support pages. Fire-and-forget; failures
 * (e.g. running outside Xaman) are swallowed so the UI never crashes.
 */
export function openBrowser(url: string): void {
  const xumm = maybeXumm();
  if (!xumm) return;
  void xumm.xapp.openBrowser({ url }).catch(() => {});
}

/**
 * Opens a Xaman sign-request payload for the user to approve / reject.
 * Resolves with { signed, txid, reason, ... } when the user acts on it.
 */
export async function openSignRequest(
  payloadUuid: string,
): Promise<SignRequestResult> {
  return getXumm().xapp.openSignRequest({ uuid: payloadUuid });
}
