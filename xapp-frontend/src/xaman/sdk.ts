// Low-level wrapper around window.xumm.
// This is the ONLY file in the codebase allowed to touch window.xumm directly.
// Every other consumer goes through useXaman() or imports from here.
// Non-negotiable #1 per xaman-xapp-frontend skill.

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
 * Returns the injected Xaman SDK. Throws if the <script> tag in index.html
 * didn't load (typical cause: dev server running outside Xaman / xAppBuilder).
 */
export function getXumm(): XummSdk {
  if (!window.xumm) {
    throw new Error(
      "xumm SDK not loaded — check the <script src=\"https://xumm.app/assets/cdn/xumm.min.js\"> tag in index.html, " +
        "and confirm you're running inside Xaman or xAppBuilder.",
    );
  }
  return window.xumm;
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
 * Waits for the Xaman native bridge to finish injecting the OTT into window.xumm.
 * Mounting React UI that reads the session before this resolves is a bug —
 * non-negotiable #5 per xaman-xapp-frontend skill.
 */
export async function waitForReady(): Promise<void> {
  const xumm = getXumm();
  await xumm.ready;
}
