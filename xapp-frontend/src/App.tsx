import { useState, useRef, useEffect } from "react";
import { useXaman } from "./xaman/useXaman";
import { ApiError, useApiClient } from "./api/client";
import { openSignRequest } from "./xaman/sdk";

type Screen = "register" | "send" | "gallery";

export default function App() {
  const { session, loading, error } = useXaman();
  const [screen, setScreen] = useState<Screen>("register");

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
        {screen === "register" ? <RegisterScreen /> : screen === "send" ? <SendScreen /> : <GalleryScreen />}
      </div>
      <TabBar screen={screen} onSwitch={setScreen} />
    </>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ screen, onSwitch }: { screen: Screen; onSwitch: (s: Screen) => void }) {
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
      {(["register", "send", "gallery"] as Screen[]).map((s) => (
        <button
          key={s}
          onClick={() => onSwitch(s)}
          style={{
            flex: 1,
            padding: "12px 0 16px",
            background: "none",
            border: "none",
            color: screen === s ? "var(--xapp-accent)" : "var(--xapp-text)",
            fontSize: "0.8em",
            fontWeight: screen === s ? 700 : 400,
            cursor: "pointer",
            opacity: screen === s ? 1 : 0.5,
            transition: "color 0.15s, opacity 0.15s",
          }}
        >
          {s === "register" ? "Get Alias" : s === "send" ? "Send" : "Gallery"}
        </button>
      ))}
    </nav>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Choose name", "Confirm", "Sign"];
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {labels.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: done ? "var(--xapp-gold)" : active ? "linear-gradient(135deg, var(--xapp-accent), var(--xapp-accent-light))" : "var(--xapp-surface-muted)",
                    color: done || active ? "#fff" : "var(--xapp-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.78em",
                    fontWeight: 700,
                    opacity: done || active ? 1 : 0.4,
                    transition: "background 0.2s",
                  }}
                >
                  {done ? "✓" : n}
                </div>
                <span
                  style={{
                    fontSize: "0.65em",
                    marginTop: 4,
                    opacity: active ? 0.9 : 0.35,
                    fontWeight: active ? 600 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: done ? "var(--xapp-gold)" : "var(--xapp-surface-muted)",
                    margin: "0 6px",
                    marginBottom: 18,
                    transition: "background 0.2s",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Register screen (3-step wizard) ──────────────────────────────────────────

type AvailStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";
type RegisterPhase = "idle" | "loading" | "signing" | "registering" | "done" | "error";

interface CreateMintData {
  uuid: string;
  websocket_status: string | null;
  price_xrp: number;
  price_drops: number;
}

type ClaimPhase = "idle" | "claiming" | "claimed" | "error";

// Identity pipeline status → user-facing label. Mirrors the /mint page state
// machine (app/templates/mint.html). Terminal states: "complete" (offer ready
// to claim) and the *_failed states (auto-retried server-side).
const MINT_STATUS_LABEL: Record<string, string> = {
  pending: "Preparing…",
  registered: "Preparing…",
  rendering: "Rendering your identity…",
  genome_stored: "Uploading to IPFS…",
  uploading: "Uploading to IPFS…",
  minting: "Minting on the XRP Ledger…",
  complete: "Identity minted",
};

function ipfsToUrl(uri: string, base: string): string {
  return uri.startsWith("ipfs://") ? `${base}/ipfs/${uri.slice(7)}` : uri;
}

function RegisterScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();
  const apiBase = import.meta.env.VITE_API_BASE_URL as string;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [avail, setAvail] = useState<AvailStatus>("idle");
  const [priceXrp, setPriceXrp] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [phase, setPhase] = useState<RegisterPhase>("idle");
  const [mintedAlias, setMintedAlias] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [walletChecking, setWalletChecking] = useState(true);
  const [existingAlias, setExistingAlias] = useState<string | null>(null);
  const [mintStatus, setMintStatus] = useState("registered");
  const [nftImageUri, setNftImageUri] = useState<string | null>(null);
  const [nftReady, setNftReady] = useState(false);
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("idle");
  const [claimErr, setClaimErr] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const account = session!.context.account;

  useEffect(() => {
    const base = apiBase;
    Promise.all([
      fetch(`${base}/api/v1/founding/status`).then((r) => r.json()),
      fetch(`${base}/api/v1/founding/wallet-check/${encodeURIComponent(account)}`).then((r) => r.json()),
    ])
      .then(([status, walletCheck]) => {
        if (status.data?.is_open) {
          setPriceXrp(status.data.price_xrp);
          setRemaining(status.data.remaining);
        }
        if (walletCheck.data?.already_registered) {
          setExistingAlias(walletCheck.data.existing_alias ?? "pay:???");
        }
      })
      .catch(() => {})
      .finally(() => setWalletChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll the identity pipeline once minted, until the NFT offer is ready to
  // claim (or a terminal state). Stops on "complete" / *_failed.
  useEffect(() => {
    if (phase !== "done" || !mintedAlias) return;
    if (mintStatus === "complete" || mintStatus.endsWith("_failed")) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(
          `${apiBase}/api/v1/founding/identity-status/${encodeURIComponent(mintedAlias)}`,
        );
        const j = await r.json();
        const d = (j.data ?? j) as {
          identity_status?: string;
          image_uri?: string | null;
          nft_offer_id?: string | null;
        };
        if (cancelled) return;
        if (d.identity_status) setMintStatus(d.identity_status);
        if (d.image_uri) setNftImageUri(ipfsToUrl(d.image_uri, apiBase));
        if (d.nft_offer_id) setNftReady(true);
      } catch {
        /* transient — keep polling */
      }
    };
    const id = setInterval(tick, 5000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, mintedAlias, mintStatus, apiBase]);

  function onNameChange(value: string) {
    const stripped = value.replace(/^pay:/i, "").toLowerCase();
    setName(stripped);
    setAvail("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (stripped.length < 1) return;
    setAvail("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await request<{ success: boolean; data: { status: string } }>(
          `/api/v1/founding/available/pay:${stripped}`,
          { method: "GET" },
        );
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
    setStep(3);

    const aliasName = `pay:${name}`;

    try {
      const resp = await request<{ success: boolean; data: CreateMintData }>(
        "/api/v1/founding/create-payment",
        {
          method: "POST",
          body: JSON.stringify({ alias_name: aliasName, xrpl_address: account }),
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
          setStep(2);
        }
      }

      openSignRequest(uuid)
        .then((r) => settle(r.signed ? r.txid : undefined, r.reason))
        .catch(() => {
          if (!settled) {
            setErrMsg("Sign request timed out");
            setPhase("error");
            setStep(2);
          }
        });

      if (websocket_status) {
        const ws = new WebSocket(websocket_status);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            if (msg.signed === true) { ws.close(); settle(msg.txid as string | undefined); }
            else if (msg.signed === false) { ws.close(); settle(undefined, "Rejected in Xaman"); }
          } catch { /* ignore heartbeats */ }
        };
        ws.onerror = () => ws.close();
      }
    } catch (e) {
      setErrMsg(e instanceof ApiError ? `Server error ${e.status}` : e instanceof Error ? e.message : String(e));
      setPhase("error");
      setStep(2);
    }
  }

  async function doRegister(aliasName: string, txHash: string) {
    setPhase("registering");
    try {
      await request("/api/v1/founding/register", {
        method: "POST",
        body: JSON.stringify({
          alias_name: aliasName,
          xrpl_address: account,
          founding_tx_hash: txHash,
        }),
      });
      setMintedAlias(aliasName);
      setPhase("done");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? ((e.body as { message?: string } | null)?.message ?? `Server error ${e.status}`)
          : e instanceof Error ? e.message : String(e);
      setErrMsg(msg);
      setPhase("error");
      setStep(2);
    }
  }

  async function claimNft() {
    if (claimPhase === "claiming") return;
    setClaimPhase("claiming");
    setClaimErr("");
    try {
      const resp = await request<{ success: boolean; data: { uuid: string } }>(
        "/api/v1/founding/claim-nft",
        { method: "POST", body: JSON.stringify({ alias_name: mintedAlias }) },
      );
      if (!resp.data?.uuid) throw new Error("No claim payload returned");
      const r = await openSignRequest(resp.data.uuid);
      if (r.signed) {
        setClaimPhase("claimed");
      } else {
        setClaimErr(r.reason ?? "Rejected in Xaman");
        setClaimPhase("error");
      }
    } catch (e) {
      setClaimErr(
        e instanceof ApiError ? `Server error ${e.status}` : e instanceof Error ? e.message : String(e),
      );
      setClaimPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setErrMsg("");
    setName("");
    setAvail("idle");
    setMintedAlias("");
    setMintStatus("registered");
    setNftImageUri(null);
    setNftReady(false);
    setClaimPhase("idle");
    setClaimErr("");
    setStep(1);
  }

  if (walletChecking) {
    return <Shell><Header account={account} /><Spinner /></Shell>;
  }

  if (existingAlias) {
    return (
      <Shell>
        <Header account={account} />
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--xapp-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 26,
              color: "#fff",
            }}
          >
            ✓
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.2em" }}>You're already registered</h2>
          <code
            style={{
              display: "block",
              fontSize: "1.15em",
              fontWeight: 700,
              color: "var(--xapp-gold)",
              margin: "0 0 12px",
            }}
          >
            {existingAlias}
          </code>
          <p style={{ opacity: 0.45, fontSize: "0.82em", margin: 0, padding: "0 24px", lineHeight: 1.5 }}>
            One alias per wallet. Use the Send tab to pay anyone on DNS://Money.
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <Header account={account} />
        <div style={{ textAlign: "center", paddingTop: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--xapp-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 32,
              color: "#fff",
            }}
          >
            ✓
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.4em" }}>You're in.</h2>
          <p style={{ opacity: 0.5, fontSize: "0.85em", margin: "0 0 20px" }}>Your alias is live on the XRP Ledger</p>
          <code
            style={{
              display: "block",
              fontSize: "1.2em",
              fontWeight: 700,
              color: "var(--xapp-gold)",
              marginBottom: 8,
            }}
          >
            {mintedAlias}
          </code>
          {nftImageUri && (
            <img
              src={nftImageUri}
              alt={`${mintedAlias} identity`}
              style={{
                width: 140,
                height: 140,
                borderRadius: 16,
                objectFit: "cover",
                display: "block",
                margin: "4px auto 20px",
                border: "1px solid var(--xapp-border)",
              }}
            />
          )}

          {claimPhase === "claimed" ? (
            <p style={{ color: "var(--xapp-success)", fontWeight: 600, fontSize: "0.9em", margin: "0 0 28px", padding: "0 24px" }}>
              NFT claimed — it's in your Xaman wallet.
            </p>
          ) : nftReady ? (
            <div style={{ margin: "0 0 28px" }}>
              <p style={{ opacity: 0.5, fontSize: "0.8em", margin: "0 0 14px", padding: "0 24px", lineHeight: 1.5 }}>
                Your identity NFT is minted. Claim it to your wallet — no payment, just a signature.
              </p>
              <Btn onClick={claimNft} active disabled={claimPhase === "claiming"}>
                {claimPhase === "claiming" ? "Opening Xaman…" : "Claim NFT to wallet"}
              </Btn>
              {claimPhase === "error" && (
                <p style={{ color: "var(--xapp-danger)", fontSize: "0.82em", margin: "10px 0 0" }}>{claimErr}</p>
              )}
            </div>
          ) : mintStatus.endsWith("_failed") ? (
            <p style={{ opacity: 0.5, fontSize: "0.8em", margin: "0 0 28px", padding: "0 24px", lineHeight: 1.5 }}>
              Minting hit a snag and is retrying automatically. Your alias is safe — check back shortly.
            </p>
          ) : (
            <p style={{ opacity: 0.55, fontSize: "0.82em", margin: "0 0 28px", padding: "0 24px", lineHeight: 1.5 }}>
              {MINT_STATUS_LABEL[mintStatus] ?? "Working…"}
              <br />
              <span style={{ opacity: 0.6 }}>This usually takes a minute or two.</span>
            </p>
          )}

          <Btn onClick={reset} active>Register another</Btn>
        </div>
      </Shell>
    );
  }

  // ── Step 1: Choose name ────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <Shell>
        <Header account={account} />
        <StepBar current={1} />

        <h2 style={{ margin: "0 0 6px", fontSize: "1.2em" }}>Choose your name</h2>
        <p style={{ opacity: 0.5, fontSize: "0.85em", margin: "0 0 24px" }}>
          Your permanent payment alias on the XRP Ledger
        </p>

        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
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
            autoFocus
          />
        </div>

        {avail !== "idle" && (
          <p
            style={{
              fontSize: "0.85em",
              margin: "8px 0 0",
              color: avail === "available" ? "var(--xapp-accent)" : avail === "checking" ? "inherit" : "var(--xapp-danger)",
              opacity: avail === "checking" ? 0.5 : 1,
            }}
          >
            {avail === "checking" && "Checking…"}
            {avail === "available" && "✓ Available"}
            {avail === "taken" && "✗ Already taken"}
            {avail === "reserved" && "✗ Reserved name"}
            {avail === "invalid" && "✗ Invalid format"}
          </p>
        )}

        <Btn
          onClick={() => setStep(2)}
          disabled={avail !== "available"}
          active={avail === "available"}
          style={{ marginTop: 28 }}
        >
          Continue →
        </Btn>
      </Shell>
    );
  }

  // ── Step 2: Confirm ────────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <Shell>
        <Header account={account} />
        <StepBar current={2} />

        <h2 style={{ margin: "0 0 6px", fontSize: "1.2em" }}>Confirm your alias</h2>
        <p style={{ opacity: 0.5, fontSize: "0.85em", margin: "0 0 24px" }}>
          Review the details before signing
        </p>

        <div
          style={{
            background: "var(--xapp-surface)",
            border: "1px solid var(--xapp-border)",
            borderRadius: 12,
            padding: "16px",
            fontSize: "0.9em",
          }}
        >
          <Row label="Alias" value={`pay:${name}`} />
          <Row label="You get" value="Alias + identity NFT" />
          {priceXrp !== null && <Row label="Cost" value={`${priceXrp} XRP`} />}
          {remaining !== null && <Row label="Slots remaining" value={String(remaining)} />}
          <Row label="Registered to" value={shortAddr(account)} mono />
        </div>

        {phase === "error" && (
          <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "12px 0 0" }}>
            {errMsg}
          </p>
        )}

        <Btn
          onClick={mint}
          disabled={phase !== "idle" && phase !== "error"}
          active={phase === "idle" || phase === "error"}
          style={{ marginTop: 24 }}
        >
          {phase === "loading" ? "Preparing…" : "Register & Mint"}
        </Btn>

        <button
          onClick={() => { setStep(1); setPhase("idle"); setErrMsg(""); }}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            padding: "10px",
            background: "none",
            border: "none",
            color: "var(--xapp-text)",
            opacity: 0.4,
            fontSize: "0.85em",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </Shell>
    );
  }

  // ── Step 3: Sign ──────────────────────────────────────────────────────────

  return (
    <Shell>
      <Header account={account} />
      <StepBar current={3} />

      <div style={{ textAlign: "center", paddingTop: 32 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "3px solid var(--xapp-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 26,
            opacity: 0.85,
          }}
        >
          ✍
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: "1.2em" }}>Sign in Xaman</h2>
        <p style={{ opacity: 0.5, fontSize: "0.88em", margin: "0 0 8px", padding: "0 24px" }}>
          {phase === "registering"
            ? "Registering your alias…"
            : "Review and approve the payment in your Xaman wallet."}
        </p>
        <p style={{ opacity: 0.35, fontSize: "0.78em", margin: 0 }}>
          {phase === "registering" ? "Almost done" : "Waiting for signature…"}
        </p>
      </div>
    </Shell>
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
  const apiBase = import.meta.env.VITE_API_BASE_URL as string;

  const [alias, setAlias] = useState("pay:");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [amount, setAmount] = useState("1");
  const [memo, setMemo] = useState("");
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
          body: JSON.stringify({ alias: alias.trim(), amount: amt, memo: memo.trim() || undefined }),
        },
      );
      if (!resp.data?.uuid) throw new Error("No payload UUID returned");

      setPhase("signing");
      const { uuid, websocket_status } = resp.data;

      let settled = false;
      function settle(signed: boolean, txid?: string, reason?: string) {
        if (settled) return;
        settled = true;
        if (signed && txid) { setTxid(txid); setPhase("done"); }
        else { setErrMsg(reason ?? "Rejected in Xaman"); setPhase("error"); }
      }

      openSignRequest(uuid)
        .then((r) => settle(r.signed, r.txid, r.reason))
        .catch(() => { if (!settled) { setErrMsg("Sign request timed out"); setPhase("error"); } });

      if (websocket_status) {
        const ws = new WebSocket(websocket_status);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            if (msg.signed === true) { ws.close(); settle(true, msg.txid as string | undefined); }
            else if (msg.signed === false) { ws.close(); settle(false, undefined, "Rejected in Xaman"); }
          } catch { /* ignore heartbeats */ }
        };
        ws.onerror = () => ws.close();
      }
    } catch (e) {
      setErrMsg(e instanceof ApiError ? `Server error ${e.status}` : e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle"); setErrMsg(""); setTxid("");
    setAlias("pay:"); setPreview(null); setPreviewErr(""); setAmount("1"); setMemo("");
  }

  const inputsReady = !!preview && !previewErr && parseFloat(amount) > 0;
  const canSend = inputsReady && phase === "idle";

  if (phase === "done") {
    return (
      <Shell>
        <Header account={ctx.account} />
        <div style={{ textAlign: "center", paddingTop: 48 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--xapp-gold)", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 28, color: "#fff",
            }}
          >
            ✓
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3em" }}>Sent!</h2>
          <p style={{ opacity: 0.5, fontSize: "0.8em", margin: "0 0 4px" }}>Transaction ID</p>
          <code style={{ fontSize: "0.72em", wordBreak: "break-all", display: "block", padding: "0 16px", opacity: 0.7 }}>
            {txid}
          </code>
          <Btn onClick={reset} active style={{ marginTop: 32 }}>Send again</Btn>
        </div>
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
        <div style={{ background: "var(--xapp-surface)", border: "1px solid var(--xapp-border)", borderRadius: 10, padding: "12px 14px", marginTop: 10, fontSize: "0.88em" }}>
          <img
            src={`${apiBase}/identity/preview/${preview.alias}`}
            alt={`${preview.alias} identity`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", display: "block", margin: "2px auto 12px", border: "1px solid var(--xapp-border)" }}
          />
          <Row label="To" value={preview.display_name ?? preview.alias} />
          <Row label="Address" value={preview.destination_address ?? "—"} mono />
          {preview.fee_estimate && <Row label="Fee" value={preview.fee_estimate} />}
        </div>
      )}
      {previewErr && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "6px 0 0" }}>{previewErr}</p>
      )}

      {preview && (
        <>
          <Label style={{ marginTop: 20 }}>Amount (XRP)</Label>
          <input
            type="number" min="0.000001" step="0.1"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            style={inputStyle} inputMode="decimal"
          />

          <Label style={{ marginTop: 20 }}>Memo (optional)</Label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, 256))}
            placeholder="What's this for?"
            style={inputStyle}
            maxLength={256}
            autoCapitalize="sentences"
            inputMode="text"
          />
        </>
      )}

      {phase === "error" && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "10px 0 0" }}>{errMsg}</p>
      )}

      <Btn
        onClick={send}
        disabled={!inputsReady || phase !== "idle"}
        active={canSend}
        style={{ marginTop: 24 }}
      >
        {phase === "loading" ? "Preparing…" : phase === "signing" ? "Waiting for signature…" : "Sign & Send"}
      </Btn>
    </Shell>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

// ── Gallery screen ────────────────────────────────────────────────────────────

interface GalleryItem {
  alias_name: string;
  nft_token_id: string | null;
  image_uri: string | null;
  created_at: string | null;
}

function GalleryScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();
  const apiBase = import.meta.env.VITE_API_BASE_URL as string;
  const account = session!.context.account;

  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    request<{ success: boolean; data: GalleryItem[] }>("/api/v1/founding/gallery", { method: "GET" })
      .then((r) => setItems(r.data ?? []))
      .catch(() => setErr("Could not load the gallery — try again shortly."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell>
      <Header account={account} />
      <h2 style={{ margin: "0 0 4px", fontSize: "1.2em" }}>Founding identities</h2>
      <p style={{ opacity: 0.5, fontSize: "0.85em", margin: "0 0 20px" }}>
        {items ? `${items.length} minted on the XRP Ledger` : "Loading…"}
      </p>

      {err && <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em" }}>{err}</p>}

      {items && items.length === 0 && !err && (
        <p style={{ opacity: 0.5, fontSize: "0.85em" }}>No identities minted yet.</p>
      )}

      {items && items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {items.map((it) => (
            <div key={it.alias_name} style={{ textAlign: "center" }}>
              <img
                src={`${apiBase}/identity/preview/${it.alias_name}`}
                alt={`${it.alias_name} identity`}
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover", border: "1px solid var(--xapp-border)", background: "var(--xapp-surface)" }}
              />
              <div style={{ fontSize: "0.62em", marginTop: 4, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.alias_name}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Header({ account }: { account: string }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <span style={{ fontWeight: 700, fontSize: "1.05em", letterSpacing: "-0.01em" }}>DNS://Money</span>
      <span style={{ fontSize: "0.72em", background: "var(--xapp-surface-muted)", borderRadius: 20, padding: "3px 10px", opacity: 0.75, fontFamily: "monospace" }}>
        {shortAddr(account)}
      </span>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ position: "relative", zIndex: 1, maxWidth: 420, margin: "0 auto", padding: "16px 16px 48px", minHeight: "100vh", background: "transparent", color: "var(--xapp-text)", boxSizing: "border-box" }}>
      {children}
    </main>
  );
}

function CenteredMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", padding: 24, background: "transparent", color: "var(--xapp-text)", textAlign: "center" }}>
      {children}
    </div>
  );
}

function Spinner() {
  return <CenteredMsg><span style={{ opacity: 0.4, fontSize: "0.9em" }}>Loading…</span></CenteredMsg>;
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: "0.75em", fontWeight: 600, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0", ...style }}>
      {children}
    </p>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", gap: 8 }}>
      <span style={{ opacity: 0.5, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : undefined, fontSize: mono ? "0.9em" : undefined, textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

function Btn({ children, onClick, disabled, active, gold, style }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  gold?: boolean;
  style?: React.CSSProperties;
}) {
  const activeBg = gold
    ? "var(--xapp-gold)"
    : "linear-gradient(135deg, var(--xapp-accent), var(--xapp-accent-light))";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block", width: "100%", padding: "14px", borderRadius: 12, border: "none",
        background: active ? activeBg : "var(--xapp-surface-muted)",
        color: active ? "#fff" : "var(--xapp-text)",
        fontSize: "1em", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 10,
  border: "1px solid var(--xapp-surface-muted)", background: "var(--xapp-surface)",
  color: "var(--xapp-text)", fontSize: "1em", outline: "none", WebkitAppearance: "none",
};

function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
