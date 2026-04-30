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

        setSession({
          ott: xAppToken,
          jwt: data.jwt,
          context: data.context,
        });

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
    "--xapp-text": "#1f2937",
    "--xapp-text-muted": "#6b7280",
    "--xapp-surface": "#f3f4f6",
    "--xapp-surface-muted": "#e5e7eb",
    "--xapp-border": "#e5e7eb",
    "--xapp-accent": "#95a9ce",
    "--xapp-accent-light": "#b0c0db",
    "--xapp-gold": "#e5b567",
    "--xapp-success": "#4caf50",
    "--xapp-warning": "#f59e0b",
    "--xapp-danger": "#ef4444",
  },
  DARK: {
    "--xapp-bg": "linear-gradient(145deg, #0f172a, #1e2937)",
    "--xapp-text": "#f1f5f9",
    "--xapp-text-muted": "#cbd5e1",
    "--xapp-surface": "#1e2937",
    "--xapp-surface-muted": "#475569",
    "--xapp-border": "rgba(149, 169, 206, 0.15)",
    "--xapp-accent": "#95a9ce",
    "--xapp-accent-light": "#b0c0db",
    "--xapp-gold": "#e5b567",
    "--xapp-success": "#4caf50",
    "--xapp-warning": "#f59e0b",
    "--xapp-danger": "#ef4444",
  },
  MOONLIGHT: {
    "--xapp-bg": "linear-gradient(145deg, #0f172a, #1e2937)",
    "--xapp-text": "#f1f5f9",
    "--xapp-text-muted": "#cbd5e1",
    "--xapp-surface": "#1e2937",
    "--xapp-surface-muted": "#475569",
    "--xapp-border": "rgba(149, 169, 206, 0.15)",
    "--xapp-accent": "#95a9ce",
    "--xapp-accent-light": "#b0c0db",
    "--xapp-gold": "#e5b567",
    "--xapp-success": "#4caf50",
    "--xapp-warning": "#f59e0b",
    "--xapp-danger": "#ef4444",
  },
  ROYAL: {
    "--xapp-bg": "linear-gradient(145deg, #0f172a, #1e2937)",
    "--xapp-text": "#f1f5f9",
    "--xapp-text-muted": "#cbd5e1",
    "--xapp-surface": "#1e2937",
    "--xapp-surface-muted": "#475569",
    "--xapp-border": "rgba(149, 169, 206, 0.15)",
    "--xapp-accent": "#95a9ce",
    "--xapp-accent-light": "#b0c0db",
    "--xapp-gold": "#e5b567",
    "--xapp-success": "#4caf50",
    "--xapp-warning": "#f59e0b",
    "--xapp-danger": "#ef4444",
  },
};

function applyXappStyle(style: string): void {
  const root = document.documentElement;
  const theme = THEMES[style as XappStyle] ?? THEMES.LIGHT;
  for (const [key, value] of Object.entries(theme)) {
    root.style.setProperty(key, value);
  }
}
