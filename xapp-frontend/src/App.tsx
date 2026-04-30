import { useState, useRef } from "react";
import { useXaman } from "./xaman/useXaman";
import { ApiError, useApiClient } from "./api/client";
import { openSignRequest } from "./xaman/sdk";

export default function App() {
  const { session, loading, error } = useXaman();

  if (loading) return <Spinner />;
  if (error || !session) {
    return (
      <CenteredMsg>
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.9em", margin: 0 }}>
          {error ?? "Session unavailable — relaunch the xApp."}
        </p>
      </CenteredMsg>
    );
  }

  return <SendScreen />;
}

// ── Send screen ───────────────────────────────────────────────────────────────

interface PreviewData {
  alias: string;
  display_name: string | null;
  destination_address: string | null;
  currency: string;
  fee_estimate: string | null;
}

interface CreatePaymentData {
  uuid: string;
  alias: string;
  amount_xrp: number;
  destination: string;
  websocket_status: string | null;
}

type Phase = "idle" | "loading" | "signing" | "done" | "error";

function SendScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();

  const [alias, setAlias] = useState("pay:");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [amount, setAmount] = useState("1");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txid, setTxid] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctx = session!.context;

  function onAliasChange(value: string) {
    setAlias(value);
    setPreview(null);
    setPreviewErr("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 5) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await request<PreviewData>(
          `/api/v1/send/preview/${encodeURIComponent(trimmed)}`,
          { method: "GET" },
        );
        setPreview(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setPreviewErr("Alias not found");
        } else {
          setPreviewErr("Could not resolve alias");
        }
      }
    }, 600);
  }

  async function send() {
    const amt = parseFloat(amount);
    if (!preview || amt <= 0) return;
    setPhase("loading");
    setErrMsg("");

    try {
      const resp = await request<{ success: boolean; data: CreatePaymentData }>(
        "/api/v1/send/create-payment",
        {
          method: "POST",
          body: JSON.stringify({ alias: alias.trim(), amount: amt }),
        },
      );
      if (!resp.data?.uuid) throw new Error("No payload UUID returned");

      setPhase("signing");
      const { uuid, websocket_status } = resp.data;

      // One-shot resolver — first path to fire wins, others are ignored.
      let settled = false;
      function settle(signed: boolean, txid?: string, reason?: string) {
        if (settled) return;
        settled = true;
        if (signed && txid) {
          setTxid(txid);
          setPhase("done");
        } else {
          setErrMsg(reason ?? "Rejected in Xaman");
          setPhase("error");
        }
      }

      // Path 1 — postMessage reply (xAppBuilder, some Xaman versions).
      openSignRequest(uuid)
        .then((r) => settle(r.signed, r.txid, r.reason))
        .catch(() => {
          if (!settled) {
            setErrMsg("Sign request timed out");
            setPhase("error");
          }
        });

      // Path 2 — Xaman payload WebSocket (real Xaman mobile).
      if (websocket_status) {
        const ws = new WebSocket(websocket_status);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            if (msg.signed === true) {
              ws.close();
              settle(true, msg.txid as string | undefined);
            } else if (msg.signed === false) {
              ws.close();
              settle(false, undefined, "Rejected in Xaman");
            }
          } catch { /* ignore heartbeats */ }
        };
        ws.onerror = () => ws.close();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErrMsg(`Server error ${e.status}`);
      } else {
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setErrMsg("");
    setTxid("");
    setAlias("pay:");
    setPreview(null);
    setPreviewErr("");
    setAmount("1");
  }

  const inputsReady = !!preview && !previewErr && parseFloat(amount) > 0;
  const canSend = inputsReady && phase === "idle";

  if (phase === "done") {
    return (
      <Shell>
        <SuccessPanel txid={txid} onReset={reset} />
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "1.05em", letterSpacing: "-0.01em" }}>
          DNS://Money
        </span>
        <span
          style={{
            fontSize: "0.72em",
            background: "var(--xapp-surface-muted)",
            borderRadius: 20,
            padding: "3px 10px",
            opacity: 0.75,
            fontFamily: "monospace",
          }}
        >
          {shortAddr(ctx.account)}
        </span>
      </header>

      {/* Section label */}
      <Label>Send to alias</Label>

      {/* Alias input */}
      <input
        value={alias}
        onChange={(e) => onAliasChange(e.target.value)}
        placeholder="pay:name"
        style={inputStyle}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
      />

      {/* Preview card */}
      {preview && (
        <div
          style={{
            background: "var(--xapp-surface)",
            borderRadius: 10,
            padding: "12px 14px",
            marginTop: 10,
            fontSize: "0.88em",
          }}
        >
          <Row label="To" value={preview.display_name ?? preview.alias} />
          <Row
            label="Address"
            value={preview.destination_address ?? "—"}
            mono
          />
          {preview.fee_estimate && (
            <Row label="Fee" value={preview.fee_estimate} />
          )}
        </div>
      )}
      {previewErr && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "6px 0 0" }}>
          {previewErr}
        </p>
      )}

      {/* Amount input — only shown once alias resolves */}
      {preview && (
        <>
          <Label style={{ marginTop: 20 }}>Amount (XRP)</Label>
          <input
            type="number"
            min="0.000001"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
            inputMode="decimal"
          />
        </>
      )}

      {/* Inline error */}
      {phase === "error" && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "10px 0 0" }}>
          {errMsg}
        </p>
      )}

      {/* CTA */}
      <Btn
        onClick={send}
        disabled={!inputsReady || phase !== "idle"}
        active={canSend}
        style={{ marginTop: 24 }}
      >
        {phase === "loading"
          ? "Preparing…"
          : phase === "signing"
            ? "Waiting for signature…"
            : "Sign & Send"}
      </Btn>
    </Shell>
  );
}

// ── Success panel ─────────────────────────────────────────────────────────────

function SuccessPanel({ txid, onReset }: { txid: string; onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 48 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--xapp-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 28,
          color: "#fff",
        }}
      >
        ✓
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: "1.3em" }}>Sent!</h2>
      <p style={{ opacity: 0.5, fontSize: "0.8em", margin: "0 0 4px" }}>Transaction ID</p>
      <code
        style={{
          fontSize: "0.72em",
          wordBreak: "break-all",
          opacity: 0.7,
          display: "block",
          padding: "0 16px",
        }}
      >
        {txid}
      </code>
      <Btn onClick={onReset} active style={{ marginTop: 36 }}>
        Send again
      </Btn>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "16px 16px 48px",
        minHeight: "100vh",
        background: "var(--xapp-bg)",
        color: "var(--xapp-text)",
        boxSizing: "border-box",
      }}
    >
      {children}
    </main>
  );
}

function CenteredMsg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: 24,
        background: "var(--xapp-bg)",
        color: "var(--xapp-text)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <CenteredMsg>
      <span style={{ opacity: 0.4, fontSize: "0.9em" }}>Loading…</span>
    </CenteredMsg>
  );
}

function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: "0.75em",
        fontWeight: 600,
        opacity: 0.45,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin: "0 0 8px 0",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "3px 0",
        gap: 8,
      }}
    >
      <span style={{ opacity: 0.5, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? "monospace" : undefined,
          fontSize: mono ? "0.9em" : undefined,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  active,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block",
        width: "100%",
        padding: "14px",
        borderRadius: 12,
        border: "none",
        background: active ? "var(--xapp-accent)" : "var(--xapp-surface-muted)",
        color: active ? "#fff" : "var(--xapp-text)",
        fontSize: "1em",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.15s, opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid var(--xapp-surface-muted)",
  background: "var(--xapp-surface)",
  color: "var(--xapp-text)",
  fontSize: "1em",
  outline: "none",
  WebkitAppearance: "none",
};

function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
