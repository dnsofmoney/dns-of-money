import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  closeXapp,
  openSignRequest as sdkOpenSignRequest,
  parseBootParams,
  signalReady,
  waitForReady,
} from "./sdk";
import type {
  OttContext,
  SignRequestResult,
  XamanNetwork,
  XamanSession,
  XappStyle,
} from "./types";

/**
 * Context value exposed via useXaman().
 * Components never touch window.xumm directly — they all go through this.
 */
interface XamanContextValue {
  session: XamanSession | null;
  loading: boolean;
  error: string | null;
  /**
   * Opens a Xaman sign request payload. Pass expectedNetwork to guard against
   * signing on the wrong network — non-negotiable #8.
   */
  openSignRequest: (
    payloadUuid: string,
    expectedNetwork?: XamanNetwork,
  ) => Promise<SignRequestResult>;
  /** Closes the xApp WebView. */
  close: () => Promise<void>;
}

const XamanContext = createContext<XamanContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── Session cache (survives WebView reloads within one xApp session) ────────
// sessionStorage is per-tab/WebView and is cleared when Xaman tears the xApp
// down, so a cached JWT can never leak into a different launch. Keyed by the
// OTT so a genuinely new launch (new OTT) always does a fresh exchange; a
// `last` pointer covers reloads that arrive without the token in the URL.
const SESSION_KEY_PREFIX = "xapp.session.";
const SESSION_LAST_KEY = "xapp.session.last";

function readCachedSession(xAppToken: string | null): XamanSession | null {
  try {
    const key = xAppToken
      ? SESSION_KEY_PREFIX + xAppToken
      : sessionStorage.getItem(SESSION_LAST_KEY);
    if (!key) return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as XamanSession;
    return parsed?.jwt && parsed?.context ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedSession(xAppToken: string, session: XamanSession): void {
  try {
    const key = SESSION_KEY_PREFIX + xAppToken;
    sessionStorage.setItem(key, JSON.stringify(session));
    sessionStorage.setItem(SESSION_LAST_KEY, key);
  } catch {
    /* storage disabled — caching is best-effort */
  }
}

interface Props {
  children: ReactNode;
}

export function XamanProvider({ children }: Props) {
  const [session, setSession] = useState<XamanSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        // 1. Give the host bridge a tick to wire up message listeners.
        //    With the raw postMessage protocol there is no SDK promise to
        //    await — the OTT is delivered via URL query params, not injected.
        await waitForReady();

        const { xAppToken } = parseBootParams();

        // 1a. Reuse a cached session if we have one. The OTT is ONE-TIME: if the
        //     WebView reloads (e.g. after returning from an external browser
        //     opened for Terms/Privacy/Support), re-POSTing the now-consumed OTT
        //     fails and shows an error screen — exactly the reviewer's
        //     "error when navigating back". So after the first successful
        //     exchange we stash {jwt, context} in sessionStorage (per-WebView,
        //     cleared when Xaman tears the xApp down) and reuse it on reload,
        //     keyed by the OTT when present, with a last-session fallback for
        //     reloads that arrive without the token in the URL.
        const cached = readCachedSession(xAppToken);
        if (cached) {
          if (!cancelled) {
            setSession(cached);
            applyXappStyle(cached.context.style);
          }
          return;
        }

        if (!xAppToken) {
          throw new Error(
            "Missing xAppToken query param — is this running inside Xaman or xAppBuilder?",
          );
        }

        // 2. Exchange OTT with our backend for {jwt, context}.
        //    The backend calls Xaman's /platform/xapp/ott/{token} using the
        //    API secret. The secret NEVER touches this client (non-negotiable #6).
        if (!API_BASE) {
          throw new Error(
            "VITE_API_BASE_URL is not set — copy .env.example to .env.local",
          );
        }

        const res = await fetch(`${API_BASE}/xapp/ott`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ott: xAppToken }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(
            `OTT exchange failed: ${res.status} ${res.statusText}` +
              (body ? ` — ${body.slice(0, 200)}` : ""),
          );
        }

        // Backend wraps all responses in the {success, data, error_code, message}
        // envelope from app/schemas/responses.py. Unwrap .data here.
        const envelope = (await res.json()) as {
          success: boolean;
          data: { jwt: string; context: OttContext } | null;
          error_code: string | null;
          message: string | null;
        };

        if (!envelope.success || !envelope.data) {
          throw new Error(
            `OTT exchange rejected: ${envelope.error_code ?? "unknown"} — ${
              envelope.message ?? "no message"
            }`,
          );
        }

        const data = envelope.data;

        if (cancelled) return;

        const newSession: XamanSession = {
          ott: xAppToken,
          jwt: data.jwt,
          context: data.context,
        };
        writeCachedSession(xAppToken, newSession);
        setSession(newSession);

        // 3. Apply the xAppStyle → CSS vars. Done once; style doesn't change
        //    mid-session in Xaman's current design.
        applyXappStyle(data.context.style);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown boot error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Tell Xaman to dismiss its native loader now that we have
          // something render-worthy (either the session panel or an
          // actionable error). Fire-and-forget; if we're outside Xaman
          // (local dev, plain browser), the message is simply ignored.
          signalReady().catch(() => {});
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const openSignRequest = async (
    payloadUuid: string,
    expectedNetwork?: XamanNetwork,
  ): Promise<SignRequestResult> => {
    if (expectedNetwork && session?.context.network !== expectedNetwork) {
      throw new Error(
        `Network mismatch: user is on ${session?.context.network ?? "unknown"}, ` +
          `this flow requires ${expectedNetwork}. ` +
          `Ask the user to switch networks in Xaman before signing.`,
      );
    }
    return sdkOpenSignRequest(payloadUuid);
  };

  const close = async (): Promise<void> => {
    await closeXapp({ refreshEvents: true });
  };

  return (
    <XamanContext.Provider
      value={{ session, loading, error, openSignRequest, close }}
    >
      {children}
    </XamanContext.Provider>
  );
}

export function useXaman(): XamanContextValue {
  const ctx = useContext(XamanContext);
  if (!ctx) {
    throw new Error("useXaman must be used inside <XamanProvider>");
  }
  return ctx;
}

// ── Theming ──────────────────────────────────────────────────────────────

const THEMES: Record<XappStyle, Record<string, string>> = {
  LIGHT: {
    "--xapp-bg": "#ffffff",
    "--xapp-text": "#0a0619",
    "--xapp-text-muted": "#6b6584",
    "--xapp-surface": "#f5f7f9",
    "--xapp-surface-muted": "#eceef1",
    "--xapp-border": "rgba(10, 6, 25, 0.1)",
    "--xapp-accent": "#00c4b4",
    "--xapp-accent-light": "#00e5c3",
    "--xapp-gold": "#2e9e57",
    "--xapp-success": "#2e9e57",
    "--xapp-warning": "#b7791f",
    "--xapp-danger": "#e8001c",
  },
  DARK: {
    "--xapp-bg": "linear-gradient(145deg, #0a0a0a, #1a1a1a)",
    "--xapp-text": "#f0f0f0",
    "--xapp-text-muted": "#888888",
    "--xapp-surface": "#111111",
    "--xapp-surface-muted": "#1f1f1f",
    "--xapp-border": "rgba(0, 196, 180, 0.15)",
    "--xapp-accent": "#00c4b4",
    "--xapp-accent-light": "#00e5c3",
    "--xapp-gold": "#00d977",
    "--xapp-success": "#00ff88",
    "--xapp-warning": "#ffaa00",
    "--xapp-danger": "#e8001c",
  },
  MOONLIGHT: {
    "--xapp-bg": "linear-gradient(145deg, #0a0a0a, #1a1a1a)",
    "--xapp-text": "#f0f0f0",
    "--xapp-text-muted": "#888888",
    "--xapp-surface": "#111111",
    "--xapp-surface-muted": "#1f1f1f",
    "--xapp-border": "rgba(0, 196, 180, 0.15)",
    "--xapp-accent": "#00c4b4",
    "--xapp-accent-light": "#00e5c3",
    "--xapp-gold": "#00d977",
    "--xapp-success": "#00ff88",
    "--xapp-warning": "#ffaa00",
    "--xapp-danger": "#e8001c",
  },
  ROYAL: {
    "--xapp-bg": "linear-gradient(145deg, #0a0a0a, #1a1a1a)",
    "--xapp-text": "#f0f0f0",
    "--xapp-text-muted": "#888888",
    "--xapp-surface": "#111111",
    "--xapp-surface-muted": "#1f1f1f",
    "--xapp-border": "rgba(0, 196, 180, 0.15)",
    "--xapp-accent": "#00c4b4",
    "--xapp-accent-light": "#00e5c3",
    "--xapp-gold": "#00d977",
    "--xapp-success": "#00ff88",
    "--xapp-warning": "#ffaa00",
    "--xapp-danger": "#e8001c",
  },
};

function applyXappStyle(_style: string): void {
  // Brand lock: the xApp always renders the teal-on-white LIGHT palette to
  // match the marketing site and brand-kit-v2, regardless of the Xaman host's
  // active theme (LIGHT/DARK/MOONLIGHT/ROYAL). Previously we followed
  // context.style, so any user whose Xaman was in dark mode saw the near-black
  // surfaces instead of teal + white. The other THEMES entries are retained
  // for reference but are intentionally no longer selected.
  const root = document.documentElement;
  const theme = THEMES.LIGHT;
  for (const [key, value] of Object.entries(theme)) {
    root.style.setProperty(key, value);
  }
}
