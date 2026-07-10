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

// Lazily constructed singleton. The constructor wires up the host message
// listeners, so we only build it once and on the client (never during SSR /
// the Vite build step).
let instance: xApp | null = null;
function sdk(): xApp {
  if (!instance) instance = new xApp();
  return instance;
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
  try {
    await sdk().ready();
  } catch {
    /* not in a host, or host didn't ack — loader dismiss is best-effort */
  }
}

/**
 * Closes the xApp WebView. Xaman tears down the native container and
 * optionally refreshes any subscribed events before returning to the wallet.
 */
export async function closeXapp(
  opts: { refreshEvents?: boolean } = {},
): Promise<void> {
  await sdk().close(opts);
}

/**
 * Opens an external URL in the device browser via the Xaman host. Used for the
 * MoonPay on-ramp hand-off and the hosted Terms / Privacy / Support pages.
 * Fire-and-forget; failures (e.g. running outside a host) are swallowed so the
 * UI never crashes.
 */
export function openBrowser(url: string): void {
  try {
    void sdk().openBrowser({ url });
  } catch {
    /* outside a host — no-op */
  }
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
export function openSignRequest(uuid: string): Promise<SignRequestResult> {
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
    s.on("payload", handler);

    // Dispatch the command. If the SDK refuses it — e.g. "Invalid payload UUID"
    // for anything that isn't a v4 uuid — the `payload` event will NEVER fire,
    // so without this the promise would hang and the user would sit on the
    // signing screen forever. Reject instead so callers can surface an error.
    const dispatched = s.openSignRequest({ uuid });
    Promise.resolve(dispatched)
      .then((res) => {
        if (res instanceof Error) {
          s.off("payload", handler);
          reject(res);
        }
      })
      .catch((err: unknown) => {
        s.off("payload", handler);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}
