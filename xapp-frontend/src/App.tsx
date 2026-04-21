import { useState } from "react";
import { useXaman } from "./xaman/useXaman";
import { ApiError, useApiClient } from "./api/client";

/**
 * Demo App — proves the OTT→JWT exchange works end-to-end.
 *
 * What this shows:
 *  - Boot state (loading / error / ready) from XamanProvider
 *  - OttContext (account, network, style, version) after exchange
 *  - A "Ping /xapp/me" button that hits a JWT-protected backend endpoint,
 *    proving the Bearer token round-trip.
 *
 * Replace this with the real mint/send flows when they're ready
 * (see xapp-mint-flow / xapp-send-flow skills).
 */
export default function App() {
  const { session, loading, error } = useXaman();

  if (loading) {
    return (
      <Shell>
        <p>Booting Xaman session…</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <h2 style={{ color: "var(--xapp-danger)" }}>Boot failed</h2>
        <p>
          <code>{error}</code>
        </p>
        <p style={{ opacity: 0.7, fontSize: "0.9em" }}>
          Common causes: running outside Xaman / xAppBuilder, backend{" "}
          <code>/xapp/ott</code> unreachable, or Xaman API secret not configured
          on the backend.
        </p>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <p>No session — this should never happen; please report.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: "1.4em", margin: "0 0 16px 0" }}>
        DNS of Money — xApp
      </h1>
      <SessionPanel />
      <hr
        style={{
          border: 0,
          borderTop: "1px solid var(--xapp-surface-muted)",
          margin: "20px 0",
        }}
      />
      <JwtRoundTripPanel />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: 16,
        background: "var(--xapp-surface)",
        borderRadius: 14,
        minHeight: "calc(100vh - 32px)",
      }}
    >
      {children}
    </main>
  );
}

function SessionPanel() {
  const { session } = useXaman();
  if (!session) return null;
  const { context } = session;
  return (
    <section>
      <h2 style={{ fontSize: "1em", opacity: 0.8, margin: "0 0 8px 0" }}>
        Session
      </h2>
      <KV k="Account" v={shortAddr(context.account)} />
      <KV k="Type" v={context.accountType} />
      <KV k="Network" v={context.network} />
      <KV k="Style" v={context.style} />
      <KV k="Locale" v={context.locale} />
      <KV k="Xaman" v={context.version} />
    </section>
  );
}

function JwtRoundTripPanel() {
  const { request } = useApiClient();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [result, setResult] = useState<unknown>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  async function ping() {
    setStatus("loading");
    setErrMsg("");
    setResult(null);
    try {
      // Backend exposes GET /xapp/me — returns {account, network} from the JWT.
      const data = await request<unknown>("/xapp/me", { method: "GET" });
      setResult(data);
      setStatus("ok");
    } catch (e) {
      if (e instanceof ApiError) {
        setErrMsg(`HTTP ${e.status}: ${JSON.stringify(e.body)}`);
      } else {
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
      setStatus("error");
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: "1em", opacity: 0.8, margin: "0 0 8px 0" }}>
        JWT round-trip
      </h2>
      <button onClick={ping} disabled={status === "loading"}>
        {status === "loading" ? "Calling…" : "Ping /xapp/me"}
      </button>
      {status === "ok" && result !== null && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--xapp-surface-muted)",
            borderRadius: 8,
            overflow: "auto",
            fontSize: "0.85em",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      {status === "error" && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.9em" }}>
          {errMsg}
        </p>
      )}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: "0.95em",
      }}
    >
      <span style={{ opacity: 0.7 }}>{k}</span>
      <code>{v}</code>
    </div>
  );
}

function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
