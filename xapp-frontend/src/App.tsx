import { useState, useRef, useEffect } from "react";
import { useXaman } from "./xaman/useXaman";
import { ApiError, useApiClient } from "./api/client";
import { openSignRequest } from "./xaman/sdk";

type Screen = "send" | "register";

export default function App() {
  const { session, loading, error } = useXaman();
  const [screen, setScreen] = useState<Screen>("send");

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

  return (
    <>
      <div style={{ paddingBottom: 64 }}>
        {screen === "send" ? <SendScreen /> : <RegisterScreen />}
      </div>
      <TabBar screen={screen} onSwitch={setScreen} />
    </>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({
  screen,
  onSwitch,
}: {
  screen: Screen;
  onSwitch: (s: Screen) => void;
}) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--xapp-surface)",
        borderTop: "1px solid var(--xapp-surface-muted)",
        display: "flex",
        zIndex: 100,
      }}
    >
      {(["send", "register"] as Screen[]).map((s) => (
        <button
          key={s}
          onClick={() => onSwitch(s)}
          style={{
            flex: 1,
            padding: "12px 0 16px",
            background: "none",
            border: "none",
            color:
              screen === s ? "var(--xapp-accent)" : "var(--xapp-text)",
            fontSize: "0.8em",
            fontWeight: screen === s ? 700 : 400,
            cursor: "pointer",
            opacity: screen === s ? 1 : 0.5,
            transition: "color 0.15s, opacity 0.15s",
          }}
        >
          {s === "send" ? "Send" : "Register"}
        </button>
      ))}
    </nav>
  );
}

// ── Send screen ───────────────────────────────────────────────────────────────

interface PreviewData {
  alias: string;
  display_name: string | null;
  destination_address: string | null;
  currency: string;
  fee_estimate: string | null;
}

interface CreateSendData {
  uuid: string;
  alias: string;
  amount_xrp: number;
  destination: string;
  websocket_status: string | null;
}

type SendPhase = "idle" | "loading" | "signing" | "done" | "error";

function SendScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();

  const [alias, setAlias] = useState("pay:");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [amount, setAmount] = useState("1");
  const [phase, setPhase] = useState<SendPhase>("idle");
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
      const resp = await request<{ success: boolean; data: CreateSendData }>(
        "/api/v1/send/create-payment",
        {
          method: "POST",
          body: JSON.stringify({ alias: alias.trim(), amount: amt }),
        },
      );
      if (!resp.data?.uuid) throw new Error("No payload UUID returned");

      setPhase("signing");
      const { uuid, websocket_status } = resp.data;

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

      openSignRequest(uuid)
        .then((r) => settle(r.signed, r.txid, r.reason))
        .catch(() => {
          if (!settled) {
            setErrMsg("Sign request timed out");
            setPhase("error");
          }
        });

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
        <SuccessPanel
          title="Sent!"
          detail={txid}
          detailLabel="Transaction ID"
          onReset={reset}
          resetLabel="Send again"
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Header account={ctx.account} />

      <Label>Send to alias</Label>

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
          <Row label="Address" value={preview.destination_address ?? "—"} mono />
          {preview.fee_estimate && <Row label="Fee" value={preview.fee_estimate} />}
        </div>
      )}
      {previewErr && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "6px 0 0" }}>
          {previewErr}
        </p>
      )}

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

      {phase === "error" && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "10px 0 0" }}>
          {errMsg}
        </p>
      )}

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

// ── Register screen ───────────────────────────────────────────────────────────

type AvailStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";
type RegisterPhase = "idle" | "loading" | "signing" | "registering" | "done" | "error";

interface CreateMintData {
  uuid: string;
  websocket_status: string | null;
  price_xrp: number;
  price_drops: number;
}

function RegisterScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();
  const apiBase = import.meta.env.VITE_API_BASE_URL as string;

  const [name, setName] = useState("");
  const [avail, setAvail] = useState<AvailStatus>("idle");
  const [priceXrp, setPriceXrp] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [phase, setPhase] = useState<RegisterPhase>("idle");
  const [mintedAlias, setMintedAlias] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load current price + remaining slots on mount (public endpoint, plain fetch)
  useEffect(() => {
    fetch(`${apiBase}/api/v1/founding/status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.is_open) {
          setPriceXrp(d.data.price_xrp);
          setRemaining(d.data.remaining);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onNameChange(value: string) {
    const stripped = value.replace(/^pay:/i, "").toLowerCase();
    setName(stripped);
    setAvail("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (stripped.length < 1) return;
    setAvail("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await request<{
          success: boolean;
          data: { alias_name: string; status: string };
        }>(`/api/v1/founding/available/pay:${stripped}`, { method: "GET" });
        setAvail(resp.data.status as AvailStatus);
      } catch {
        setAvail("invalid");
      }
    }, 600);
  }

  async function mint() {
    if (avail !== "available" || phase !== "idle") return;
    setPhase("loading");
    setErrMsg("");

    const aliasName = `pay:${name}`;

    try {
      const resp = await request<{ success: boolean; data: CreateMintData }>(
        "/api/v1/founding/create-payment",
        {
          method: "POST",
          body: JSON.stringify({ alias_name: aliasName }),
        },
      );
      if (!resp.data?.uuid) throw new Error("No payload UUID returned");

      setPhase("signing");
      const { uuid, websocket_status } = resp.data;

      let settled = false;
      function settle(txid?: string, reason?: string) {
        if (settled) return;
        settled = true;
        if (txid) {
          doRegister(aliasName, txid);
        } else {
          setErrMsg(reason ?? "Rejected in Xaman");
          setPhase("error");
        }
      }

      openSignRequest(uuid)
        .then((r) => settle(r.signed ? r.txid : undefined, r.reason))
        .catch(() => {
          if (!settled) {
            setErrMsg("Sign request timed out");
            setPhase("error");
          }
        });

      if (websocket_status) {
        const ws = new WebSocket(websocket_status);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            if (msg.signed === true) {
              ws.close();
              settle(msg.txid as string | undefined);
            } else if (msg.signed === false) {
              ws.close();
              settle(undefined, "Rejected in Xaman");
            }
          } catch { /* ignore heartbeats */ }
        };
        ws.onerror = () => ws.close();
      }
    } catch (e) {
      setErrMsg(e instanceof ApiError ? `Server error ${e.status}` : e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  async function doRegister(aliasName: string, txHash: string) {
    setPhase("registering");
    try {
      await request("/api/v1/founding/register", {
        method: "POST",
        body: JSON.stringify({
          alias_name: aliasName,
          xrpl_address: session!.context.account,
          founding_tx_hash: txHash,
        }),
      });
      setMintedAlias(aliasName);
      setPhase("done");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? ((e.body as { message?: string } | null)?.message ?? `Server error ${e.status}`)
          : e instanceof Error
            ? e.message
            : String(e);
      setErrMsg(msg);
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setErrMsg("");
    setName("");
    setAvail("idle");
    setMintedAlias("");
  }

  const inputsReady = avail === "available";
  const canMint = inputsReady && phase === "idle";

  if (phase === "done") {
    return (
      <Shell>
        <SuccessPanel
          title="Registered!"
          detail={mintedAlias}
          detailLabel="Your alias"
          subtext="Identity NFT is being minted — check back in a few minutes."
          onReset={reset}
          resetLabel="Register another"
          accentDetail
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Header account={session!.context.account} />

      <Label>Register alias</Label>

      {/* pay: prefix shown inline */}
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--xapp-text)",
            opacity: 0.4,
            fontSize: "1em",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          pay:
        </span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="yourname"
          style={{ ...inputStyle, paddingLeft: 52 }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {/* Availability */}
      {avail !== "idle" && (
        <p
          style={{
            fontSize: "0.85em",
            margin: "6px 0 0",
            color: availColor(avail),
          }}
        >
          {availLabel(avail)}
        </p>
      )}

      {/* Price + slots */}
      {avail === "available" && priceXrp !== null && (
        <div
          style={{
            background: "var(--xapp-surface)",
            borderRadius: 10,
            padding: "12px 14px",
            marginTop: 12,
            fontSize: "0.88em",
          }}
        >
          <Row label="Cost" value={`${priceXrp} XRP`} />
          <Row label="You get" value="pay:name + identity NFT" />
          {remaining !== null && (
            <Row label="Slots left" value={String(remaining)} />
          )}
        </div>
      )}

      {phase === "error" && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "10px 0 0" }}>
          {errMsg}
        </p>
      )}

      <Btn
        onClick={mint}
        disabled={!inputsReady || phase !== "idle"}
        active={canMint}
        style={{ marginTop: 24 }}
      >
        {phase === "loading"
          ? "Preparing…"
          : phase === "signing"
            ? "Waiting for signature…"
            : phase === "registering"
              ? "Registering…"
              : "Register & Mint"}
      </Btn>
    </Shell>
  );
}

function availColor(s: AvailStatus): string {
  if (s === "available") return "var(--xapp-accent)";
  if (s === "checking") return "inherit";
  return "var(--xapp-danger)";
}

function availLabel(s: AvailStatus): string {
  switch (s) {
    case "checking": return "Checking…";
    case "available": return "✓ Available";
    case "taken": return "✗ Already taken";
    case "reserved": return "✗ Reserved name";
    case "invalid": return "✗ Invalid format";
    default: return "";
  }
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SuccessPanel({
  title,
  detail,
  detailLabel,
  subtext,
  onReset,
  resetLabel,
  accentDetail,
}: {
  title: string;
  detail: string;
  detailLabel: string;
  subtext?: string;
  onReset: () => void;
  resetLabel: string;
  accentDetail?: boolean;
}) {
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
      <h2 style={{ margin: "0 0 6px", fontSize: "1.3em" }}>{title}</h2>
      <p style={{ opacity: 0.5, fontSize: "0.8em", margin: "0 0 4px" }}>{detailLabel}</p>
      <code
        style={{
          fontSize: accentDetail ? "1.05em" : "0.72em",
          fontWeight: accentDetail ? 700 : 400,
          color: accentDetail ? "var(--xapp-accent)" : "inherit",
          wordBreak: "break-all",
          display: "block",
          padding: "0 16px",
          opacity: accentDetail ? 1 : 0.7,
        }}
      >
        {detail}
      </code>
      {subtext && (
        <p style={{ opacity: 0.45, fontSize: "0.78em", marginTop: 10, padding: "0 24px" }}>
          {subtext}
        </p>
      )}
      <Btn onClick={onReset} active style={{ marginTop: 32 }}>
        {resetLabel}
      </Btn>
    </div>
  );
}

function Header({ account }: { account: string }) {
  return (
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
        {shortAddr(account)}
      </span>
    </header>
  );
}

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
