import { useState, useRef, useEffect, useCallback } from "react";
import { useXaman } from "./xaman/useXaman";
import { ApiError, useApiClient } from "./api/client";
import { openBrowser, openSignRequest } from "./xaman/sdk";
import { useT, useI18n, useXamanLocale, SUPPORTED, LOCALE_LABELS, type TFunc } from "./i18n";

// ── Client telemetry ──────────────────────────────────────────────────────────
// Best-effort POST of one sign-funnel event to the backend (POST /xapp/event).
// Fire-and-forget: telemetry must never break or block the user flow, so every
// failure is swallowed. Account/network are derived server-side from the JWT.
type EventFields = { alias?: string; payload_uuid?: string; detail?: string };
function useEventLogger(flow: "register" | "send" | "claim") {
  const { request } = useApiClient();
  return useCallback(
    (event: string, extra?: EventFields) => {
      request("/xapp/event", {
        method: "POST",
        body: JSON.stringify({ flow, event, ...extra }),
      }).catch(() => {});
    },
    [request, flow],
  );
}

type Screen = "register" | "send" | "gallery" | "buy";

export default function App() {
  const { session, loading, error } = useXaman();
  const [screen, setScreen] = useState<Screen>("register");
  const [sendAlias, setSendAlias] = useState<string | null>(null);
  const t = useT();

  // Manual tab presses always start Send fresh; only the gallery's "Send"
  // action pre-fills an alias (via goSendTo, which bypasses this).
  function switchTab(s: Screen) {
    setSendAlias(null);
    setScreen(s);
  }
  function goSendTo(alias: string) {
    setSendAlias(alias);
    setScreen("send");
  }

  // Apply the Xaman-reported locale once the session resolves (unless the user
  // has manually chosen a language). Hook runs unconditionally, before returns.
  useXamanLocale(session?.context.locale);

  if (loading) return <Spinner />;
  if (error || !session) {
    return (
      <CenteredMsg>
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.9em", margin: 0 }}>
          {error ?? t("common.sessionUnavailable")}
        </p>
      </CenteredMsg>
    );
  }

  return (
    <>
      <div style={{ paddingBottom: 64 }}>
        {screen === "register" ? <RegisterScreen /> : screen === "send" ? <SendScreen initialAlias={sendAlias} /> : screen === "gallery" ? <GalleryScreen onSend={goSendTo} /> : <BuyScreen />}
      </div>
      <TabBar screen={screen} onSwitch={switchTab} />
    </>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ screen, onSwitch }: { screen: Screen; onSwitch: (s: Screen) => void }) {
  const t = useT();
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
      {(["register", "send", "gallery", "buy"] as Screen[]).map((s) => (
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
          {t(`tabs.${s}`)}
        </button>
      ))}
    </nav>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const t = useT();
  const labels = [t("steps.chooseName"), t("steps.confirm"), t("steps.sign")];
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
                    fontSize: "0.75em",
                    marginTop: 4,
                    color: active ? undefined : "var(--xapp-text-muted)",
                    opacity: active ? 0.9 : 0.85,
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
  deeplink: string | null;
  price_xrp: number;
  price_drops: number;
}

// Sign-request fallback context — kept in state so the signing screen can
// re-open the request (or hand off to Xaman via the deeplink) when the in-app
// postMessage bridge silently fails to surface the sign request.
interface SignFallbackCtx {
  uuid: string;
  deeplink: string | null;
}

type ClaimPhase = "idle" | "claiming" | "claimed" | "error";

// Identity pipeline status → i18n key under mintStatus. Mirrors the /mint page
// state machine (app/templates/mint.html). Terminal states: "complete" (offer
// ready to claim) and the *_failed states (auto-retried server-side).
const MINT_STATUS_KEY: Record<string, string> = {
  pending: "preparing",
  registered: "preparing",
  rendering: "rendering",
  genome_stored: "uploading",
  uploading: "uploading",
  minting: "minting",
  complete: "complete",
};

function mintStatusLabel(t: TFunc, status: string): string {
  const key = MINT_STATUS_KEY[status];
  return key ? t(`mintStatus.${key}`) : t("mintStatus.working");
}

function ipfsToUrl(uri: string, base: string): string {
  return uri.startsWith("ipfs://") ? `${base}/ipfs/${uri.slice(7)}` : uri;
}

function RegisterScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();
  const t = useT();
  const logEvent = useEventLogger("register");
  const logClaim = useEventLogger("claim");
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
  const [signCtx, setSignCtx] = useState<SignFallbackCtx | null>(null);
  const [claimSignCtx, setClaimSignCtx] = useState<SignFallbackCtx | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lets the signing screen's "Open sign request" button route a re-opened
  // request into the same settle logic the initial attempt uses.
  const settleRef = useRef<((signed: boolean, txid?: string) => void) | null>(null);

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
      const { uuid, websocket_status, deeplink } = resp.data;
      setSignCtx({ uuid, deeplink: deeplink ?? null });
      logEvent("payload_created", { alias: aliasName, payload_uuid: uuid });

      let settled = false;
      function settle(signed: boolean, txid?: string, reason?: string) {
        if (settled) return;
        // Only a confirmed signature is terminal. A rejection/timeout from one
        // attempt must not lock out the deeplink/re-open fallback, which may
        // still be signed via the live websocket subscription below.
        if (signed && txid) {
          settled = true;
          logEvent("signed", { alias: aliasName, payload_uuid: uuid });
          doRegister(aliasName, txid);
        } else {
          logEvent("rejected", { alias: aliasName, payload_uuid: uuid, detail: reason });
          setErrMsg(reason ?? t("common.rejectedInXaman"));
          setPhase("error");
          setStep(2);
        }
      }
      // Re-opened sign requests (fallback button) route their result here too.
      settleRef.current = (signed, txid) => settle(signed, txid);

      logEvent("sign_opened", { alias: aliasName, payload_uuid: uuid });
      // openSignRequest resolves via the xApp `payload` event (SIGNED/DECLINED,
      // no txid). A signature is settled by the websocket below — which also
      // carries the tx hash register needs — so here we only act on a decline,
      // so the user isn't left waiting after rejecting in Xaman.
      openSignRequest(uuid)
        .then((r) => { if (!r.signed) settle(false, undefined, r.reason); })
        .catch(() => {});

      if (websocket_status) {
        const ws = new WebSocket(websocket_status);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            if (msg.signed === true) { ws.close(); settle(true, msg.txid as string | undefined); }
            else if (msg.signed === false) { ws.close(); settle(false, undefined, t("common.rejectedInXaman")); }
          } catch { /* ignore heartbeats */ }
        };
        ws.onerror = () => ws.close();
      }
    } catch (e) {
      // 409 = this wallet already has a founding alias (one per wallet). Route
      // to the clean "already registered" screen instead of a raw error code —
      // e.g. after tapping "Register another", or relaunching post-registration.
      if (e instanceof ApiError && e.status === 409) {
        try {
          const wc = await fetch(
            `${apiBase}/api/v1/founding/wallet-check/${encodeURIComponent(account)}`,
          ).then((r) => r.json());
          if (wc.data?.already_registered) {
            setExistingAlias(wc.data.existing_alias ?? "pay:???");
            return;
          }
        } catch {
          /* fall through to the inline message */
        }
        setErrMsg(t("register.oneAliasPerWallet"));
        setPhase("error");
        setStep(2);
        return;
      }
      const msg =
        e instanceof ApiError
          ? ((e.body as { message?: string } | null)?.message ?? t("common.serverError", { status: e.status }))
          : e instanceof Error ? e.message : String(e);
      setErrMsg(msg);
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
          ? ((e.body as { message?: string } | null)?.message ?? t("common.serverError", { status: e.status }))
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
      const resp = await request<{ success: boolean; data: { uuid: string; deeplink: string | null } }>(
        "/api/v1/founding/claim-nft",
        { method: "POST", body: JSON.stringify({ alias_name: mintedAlias }) },
      );
      if (!resp.data?.uuid) throw new Error("No claim payload returned");
      setClaimSignCtx({ uuid: resp.data.uuid, deeplink: resp.data.deeplink ?? null });
      logClaim("payload_created", { alias: mintedAlias, payload_uuid: resp.data.uuid });
      logClaim("sign_opened", { alias: mintedAlias, payload_uuid: resp.data.uuid });
      const r = await openSignRequest(resp.data.uuid);
      if (r.signed) {
        logClaim("signed", { alias: mintedAlias, payload_uuid: resp.data.uuid });
        setClaimPhase("claimed");
      } else {
        logClaim("rejected", { alias: mintedAlias, payload_uuid: resp.data.uuid, detail: r.reason });
        setClaimErr(r.reason ?? t("common.rejectedInXaman"));
        setClaimPhase("error");
      }
    } catch (e) {
      setClaimErr(
        e instanceof ApiError ? t("common.serverError", { status: e.status }) : e instanceof Error ? e.message : String(e),
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
    setSignCtx(null);
    setClaimSignCtx(null);
    setStep(1);
  }

  // Re-post the sign request over the bridge (fallback for when the host
  // didn't surface it the first time). Result routes through the same settle.
  function reopenSign() {
    if (!signCtx) return;
    logEvent("fallback_reopen", { payload_uuid: signCtx.uuid });
    // Re-open over the bridge; a signature still settles via the websocket, so
    // we only forward a decline here.
    openSignRequest(signCtx.uuid)
      .then((r) => { if (!r.signed) settleRef.current?.(false, undefined); })
      .catch(() => {});
  }

  function reopenClaim() {
    if (!claimSignCtx) return;
    logClaim("fallback_reopen", { payload_uuid: claimSignCtx.uuid });
    openSignRequest(claimSignCtx.uuid)
      .then((r) => { if (r.signed) setClaimPhase("claimed"); })
      .catch(() => {});
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
          <h2 style={{ margin: "0 0 8px", fontSize: "1.2em" }}>{t("register.alreadyTitle")}</h2>
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
          <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.82em", margin: 0, padding: "0 24px", lineHeight: 1.5 }}>
            {t("register.oneAliasPerWallet")}
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
          <h2 style={{ margin: "0 0 6px", fontSize: "1.4em" }}>{t("register.doneTitle")}</h2>
          <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.85em", margin: "0 0 20px" }}>{t("register.doneSubtitle")}</p>
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
              {t("register.nftClaimed")}
            </p>
          ) : nftReady ? (
            <div style={{ margin: "0 0 28px" }}>
              <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.8em", margin: "0 0 14px", padding: "0 24px", lineHeight: 1.5 }}>
                {t("register.nftReadyHint")}
              </p>
              <Btn onClick={claimNft} active disabled={claimPhase === "claiming"}>
                {claimPhase === "claiming" ? t("register.openingXaman") : t("register.claimNft")}
              </Btn>
              {claimPhase === "claiming" && claimSignCtx && (
                <SignFallback
                  uuid={claimSignCtx.uuid}
                  deeplink={claimSignCtx.deeplink}
                  onReopen={reopenClaim}
                  onDeeplink={() => {
                    logClaim("fallback_deeplink", { payload_uuid: claimSignCtx.uuid });
                    if (claimSignCtx.deeplink) openBrowser(claimSignCtx.deeplink);
                  }}
                />
              )}
              {claimPhase === "error" && (
                <p style={{ color: "var(--xapp-danger)", fontSize: "0.82em", margin: "10px 0 0" }}>{claimErr}</p>
              )}
            </div>
          ) : mintStatus.endsWith("_failed") ? (
            <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.8em", margin: "0 0 28px", padding: "0 24px", lineHeight: 1.5 }}>
              {t("register.mintRetrying")}
            </p>
          ) : (
            <p style={{ opacity: 0.55, fontSize: "0.82em", margin: "0 0 28px", padding: "0 24px", lineHeight: 1.5 }}>
              {mintStatusLabel(t, mintStatus)}
              <br />
              <span style={{ opacity: 0.6 }}>{t("register.mintTakesAMinute")}</span>
            </p>
          )}

          <Btn onClick={reset} active>{t("register.registerAnother")}</Btn>
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

        <h2 style={{ margin: "0 0 6px", fontSize: "1.2em" }}>{t("register.step1Title")}</h2>
        <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.85em", margin: "0 0 24px" }}>
          {t("register.step1Subtitle")}
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
            placeholder={t("register.namePlaceholder")}
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
            {avail === "checking" && t("avail.checking")}
            {avail === "available" && t("avail.available")}
            {avail === "taken" && t("avail.taken")}
            {avail === "reserved" && t("avail.reserved")}
            {avail === "invalid" && t("avail.invalid")}
          </p>
        )}

        <Btn
          onClick={() => setStep(2)}
          disabled={avail !== "available"}
          active={avail === "available"}
          style={{ marginTop: 28 }}
        >
          {t("register.continue")}
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

        <h2 style={{ margin: "0 0 6px", fontSize: "1.2em" }}>{t("register.step2Title")}</h2>
        <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.85em", margin: "0 0 24px" }}>
          {t("register.step2Subtitle")}
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
          <Row label={t("register.rowAlias")} value={`pay:${name}`} />
          <Row label={t("register.rowYouGet")} value={t("register.youGetValue")} />
          {priceXrp !== null && <Row label={t("register.rowCost")} value={t("register.costValue", { price: priceXrp })} />}
          {remaining !== null && <Row label={t("register.rowSlotsRemaining")} value={String(remaining)} />}
          <Row label={t("register.rowRegisteredTo")} value={shortAddr(account)} mono />
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
          {phase === "loading" ? t("common.preparing") : t("register.registerAndMint")}
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
          {t("common.back")}
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
        <h2 style={{ margin: "0 0 8px", fontSize: "1.2em" }}>{t("register.step3Title")}</h2>
        <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.88em", margin: "0 0 8px", padding: "0 24px" }}>
          {phase === "registering"
            ? t("register.registeringAlias")
            : t("register.approveInXaman")}
        </p>
        <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.78em", margin: 0 }}>
          {phase === "registering" ? t("register.almostDone") : t("common.waitingSignature")}
        </p>

        {phase === "signing" && signCtx && (
          <SignFallback
            uuid={signCtx.uuid}
            deeplink={signCtx.deeplink}
            onReopen={reopenSign}
            onDeeplink={() => {
              logEvent("fallback_deeplink", { payload_uuid: signCtx.uuid });
              if (signCtx.deeplink) openBrowser(signCtx.deeplink);
            }}
          />
        )}
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
  deeplink: string | null;
}

type SendPhase = "idle" | "loading" | "signing" | "done" | "error";

function SendScreen({ initialAlias }: { initialAlias?: string | null }) {
  const { session } = useXaman();
  const { request } = useApiClient();
  const t = useT();
  const logEvent = useEventLogger("send");
  const apiBase = import.meta.env.VITE_API_BASE_URL as string;

  const [alias, setAlias] = useState(initialAlias ?? "pay:");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [amount, setAmount] = useState("1");
  const [memo, setMemo] = useState("");
  const [phase, setPhase] = useState<SendPhase>("idle");
  const [txid, setTxid] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [signCtx, setSignCtx] = useState<SignFallbackCtx | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRef = useRef<((signed: boolean, txid?: string) => void) | null>(null);

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
          setPreviewErr(t("send.aliasNotFound"));
        } else {
          setPreviewErr(t("send.couldNotResolve"));
        }
      }
    }, 600);
  }

  // Arrived from the gallery with a chosen alias — resolve its preview now.
  useEffect(() => {
    if (initialAlias) onAliasChange(initialAlias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const { uuid, websocket_status, deeplink } = resp.data;
      setSignCtx({ uuid, deeplink: deeplink ?? null });
      logEvent("payload_created", { alias: alias.trim(), payload_uuid: uuid });

      let settled = false;
      function settle(signed: boolean, txid?: string, reason?: string) {
        if (settled) return;
        if (signed && txid) {
          settled = true;
          logEvent("signed", { alias: alias.trim(), payload_uuid: uuid });
          setTxid(txid);
          setPhase("done");
        } else {
          logEvent("rejected", { alias: alias.trim(), payload_uuid: uuid, detail: reason });
          setErrMsg(reason ?? t("common.rejectedInXaman"));
          setPhase("error");
        }
      }
      settleRef.current = (signed, txid) => settle(signed, txid);

      logEvent("sign_opened", { alias: alias.trim(), payload_uuid: uuid });
      // Signature (with txid) is settled by the websocket below; openSignRequest
      // resolves via the xApp `payload` event, so we only act on a decline.
      openSignRequest(uuid)
        .then((r) => { if (!r.signed) settle(false, undefined, r.reason); })
        .catch(() => {});

      if (websocket_status) {
        const ws = new WebSocket(websocket_status);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            if (msg.signed === true) { ws.close(); settle(true, msg.txid as string | undefined); }
            else if (msg.signed === false) { ws.close(); settle(false, undefined, t("common.rejectedInXaman")); }
          } catch { /* ignore heartbeats */ }
        };
        ws.onerror = () => ws.close();
      }
    } catch (e) {
      setErrMsg(e instanceof ApiError ? t("common.serverError", { status: e.status }) : e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle"); setErrMsg(""); setTxid("");
    setAlias("pay:"); setPreview(null); setPreviewErr(""); setAmount("1"); setMemo("");
    setSignCtx(null);
  }

  function reopenSign() {
    if (!signCtx) return;
    logEvent("fallback_reopen", { payload_uuid: signCtx.uuid });
    // A signature still settles via the websocket; only forward a decline here.
    openSignRequest(signCtx.uuid)
      .then((r) => { if (!r.signed) settleRef.current?.(false, undefined); })
      .catch(() => {});
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
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3em" }}>{t("send.sentTitle")}</h2>
          <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.8em", margin: "0 0 4px" }}>{t("send.transactionId")}</p>
          <code style={{ fontSize: "0.75em", wordBreak: "break-all", display: "block", padding: "0 16px", opacity: 0.7 }}>
            {txid}
          </code>
          <Btn onClick={reset} active style={{ marginTop: 32 }}>{t("send.sendAgain")}</Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header account={ctx.account} />

      <Label>{t("send.sendToAlias")}</Label>
      <input
        value={alias}
        onChange={(e) => onAliasChange(e.target.value)}
        placeholder={t("send.aliasPlaceholder")}
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
          <Row label={t("send.rowTo")} value={preview.display_name ?? preview.alias} />
          <Row label={t("send.rowAddress")} value={preview.destination_address ?? "—"} mono />
          {preview.fee_estimate && <Row label={t("send.rowFee")} value={preview.fee_estimate} />}
        </div>
      )}
      {previewErr && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "6px 0 0" }}>{previewErr}</p>
      )}

      {preview && (
        <>
          <Label style={{ marginTop: 20 }}>{t("send.amountLabel")}</Label>
          <input
            type="number" min="0.000001" step="0.1"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            style={inputStyle} inputMode="decimal"
          />

          <Label style={{ marginTop: 20 }}>{t("send.memoLabel")}</Label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, 256))}
            placeholder={t("send.memoPlaceholder")}
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
        {phase === "loading" ? t("common.preparing") : phase === "signing" ? t("common.waitingSignature") : t("send.signAndSend")}
      </Btn>

      {phase === "signing" && signCtx && (
        <SignFallback
          uuid={signCtx.uuid}
          deeplink={signCtx.deeplink}
          onReopen={reopenSign}
          onDeeplink={() => {
            logEvent("fallback_deeplink", { payload_uuid: signCtx.uuid });
            if (signCtx.deeplink) openBrowser(signCtx.deeplink);
          }}
        />
      )}
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

// ipfs://<cid>[/path] (or ipfs://ipfs/<cid>) → a public HTTPS gateway URL.
// Used only for the "Open image" hand-off, where we want the canonical
// full-resolution NFT art at a permanent URL rather than the downscaled
// on-demand render. ipfs.io served these CIDs with a direct 200 in testing.
function ipfsToHttp(uri: string): string {
  const path = uri.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "");
  return `https://ipfs.io/ipfs/${path}`;
}

function GalleryScreen({ onSend }: { onSend: (alias: string) => void }) {
  const { session } = useXaman();
  const { request } = useApiClient();
  const t = useT();
  const apiBase = import.meta.env.VITE_API_BASE_URL as string;
  const account = session!.context.account;
  const previewUrl = (a: string) => `${apiBase}/identity/preview/${a}`;

  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [err, setErr] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const touchStartX = useRef<number | null>(null);

  async function copyTokenId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked in this WebView — no-op rather than a broken state */
    }
  }

  useEffect(() => {
    request<{ success: boolean; data: { count: number; cap: number; aliases: GalleryItem[] } }>(
      "/api/v1/founding/gallery",
      { method: "GET" },
    )
      .then((r) => setItems(r.data?.aliases ?? []))
      .catch(() => setErr(t("gallery.loadError")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = items?.length ?? 0;

  function step(delta: number) {
    setOpenIdx((i) => (i === null ? i : Math.min(total - 1, Math.max(0, i + delta))));
  }
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); // swipe left → next
  }

  // Keyboard control while the carousel is open (desktop / a11y).
  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the "copied" flash whenever the open image changes (or closes).
  useEffect(() => { setCopied(false); }, [openIdx]);

  const sel = openIdx !== null && items ? items[openIdx] : null;
  const navBtn = (disabled: boolean): React.CSSProperties => ({
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    width: 38, height: 38, borderRadius: 19, border: "none", zIndex: 1,
    background: "rgba(255, 255, 255, 0.14)", color: "#fff",
    fontSize: "1.5em", lineHeight: 1, cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.25 : 1,
  });

  return (
    <Shell>
      <Header account={account} />
      <h2 style={{ margin: "0 0 4px", fontSize: "1.2em" }}>{t("gallery.title")}</h2>
      <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.85em", margin: "0 0 20px" }}>
        {items ? t("gallery.countMinted", { count: items.length }) : t("common.loading")}
      </p>

      {err && <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em" }}>{err}</p>}

      {items && items.length === 0 && !err && (
        <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.85em" }}>{t("gallery.empty")}</p>
      )}

      {items && items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {items.map((it, i) => (
            <GalleryTile
              key={it.alias_name}
              src={previewUrl(it.alias_name)}
              label={it.alias_name}
              ariaLabel={t("gallery.viewIdentity", { alias: it.alias_name })}
              onClick={() => setOpenIdx(i)}
            />
          ))}
        </div>
      )}

      {sel && openIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sel.alias_name}
          onClick={() => setOpenIdx(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 20, boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            aria-label={t("gallery.close")}
            style={{
              position: "absolute", top: 16, right: 16, zIndex: 2,
              width: 44, height: 44, borderRadius: 22,
              border: "1px solid rgba(255, 255, 255, 0.3)",
              background: "rgba(0, 0, 0, 0.55)", color: "#fff",
              fontSize: "1.25em", lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <button type="button" onClick={() => step(-1)} disabled={openIdx === 0} aria-label={t("gallery.prev")} style={{ ...navBtn(openIdx === 0), left: 0 }}>‹</button>
            <img
              src={previewUrl(sel.alias_name)}
              alt={`${sel.alias_name} identity`}
              style={{ maxWidth: "80%", maxHeight: "60vh", borderRadius: 12, border: "1px solid var(--xapp-border)", objectFit: "contain" }}
            />
            <button type="button" onClick={() => step(1)} disabled={openIdx === total - 1} aria-label={t("gallery.next")} style={{ ...navBtn(openIdx === total - 1), right: 0 }}>›</button>
          </div>

          {/* Preload immediate neighbours so swiping feels instant. */}
          {[openIdx - 1, openIdx + 1]
            .filter((n) => n >= 0 && n < total)
            .map((n) => (
              <img key={n} src={previewUrl(items![n].alias_name)} alt="" aria-hidden="true" style={{ display: "none" }} />
            ))}

          <div style={{ color: "#fff", fontSize: "1.05em", fontWeight: 600, marginTop: 16 }}>{sel.alias_name}</div>
          {sel.nft_token_id && (
            <button
              type="button"
              onClick={() => copyTokenId(sel.nft_token_id!)}
              aria-label={t("gallery.copyTokenId")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
                padding: "5px 11px", borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.18)",
                background: "rgba(255, 255, 255, 0.06)",
                color: copied ? "var(--xapp-gold)" : "rgba(255, 255, 255, 0.72)",
                fontFamily: "monospace", fontSize: "0.72em", cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {copied
                ? t("gallery.tokenIdCopied")
                : <>{shortAddr(sel.nft_token_id)} <span aria-hidden="true" style={{ opacity: 0.7 }}>⧉</span></>}
            </button>
          )}
          <div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.72em", marginTop: 10 }}>
            {t("gallery.position", { index: openIdx + 1, total })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, width: "100%", maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <Btn active onClick={() => onSend(sel.alias_name)} style={{ flex: 1 }}>
              {t("gallery.send")}
            </Btn>
            <Btn onClick={() => openBrowser(sel.image_uri ? ipfsToHttp(sel.image_uri) : previewUrl(sel.alias_name))} style={{ flex: 1 }}>
              {t("gallery.openImage")}
            </Btn>
          </div>
        </div>
      )}
    </Shell>
  );
}

// Lazy gallery tile — defers the image request until the tile nears the
// viewport (IntersectionObserver), so we never fire all ~40 preview requests
// at once. The preview endpoint renders on demand (~0.5–1.3s, uncached).
function GalleryTile({ src, label, ariaLabel, onClick }: {
  src: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div style={{ textAlign: "center", minWidth: 0 }}>
      {/* padding-top:100% forces a perfect square in every WebView —
          aspect-ratio CSS is unreliable in Xaman's in-app browser. */}
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        style={{ position: "relative", display: "block", width: "100%", padding: 0, paddingTop: "100%", borderRadius: 10, overflow: "hidden", border: "1px solid var(--xapp-border)", background: "var(--xapp-surface)", cursor: "pointer" }}
      >
        {visible && (
          <img
            src={src}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </button>
      <div style={{ fontSize: "0.75em", marginTop: 4, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
    </div>
  );
}

// ── Buy screen (fiat → XRP on-ramp, MoonPay) ──────────────────────────────────

interface OnrampAddress {
  alias: string;
  currency: string;
  wallet_address: string;
}

type BuyPhase = "idle" | "preparing" | "opened" | "error";

function BuyScreen() {
  const { session } = useXaman();
  const { request } = useApiClient();
  const t = useT();
  const account = session!.context.account;

  const [alias, setAlias] = useState("pay:");
  const [resolved, setResolved] = useState<OnrampAddress | null>(null);
  const [resolveErr, setResolveErr] = useState("");
  const [phase, setPhase] = useState<BuyPhase>("idle");
  const [errMsg, setErrMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onAliasChange(value: string) {
    setAlias(value);
    setResolved(null);
    setResolveErr("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const stripped = value.replace(/^pay:/i, "").trim().toLowerCase();
    if (stripped.length < 1) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await request<OnrampAddress>(
          `/api/v1/onramp/address/pay:${encodeURIComponent(stripped)}`,
          { method: "GET" },
        );
        setResolved(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setResolveErr(t("buy.aliasNotFound"));
        else if (e instanceof ApiError && e.status === 422) setResolveErr(t("buy.noXrplAddress"));
        else if (e instanceof ApiError && e.status === 503) setResolveErr(t("buy.notAvailable"));
        else setResolveErr(t("buy.couldNotResolve"));
      }
    }, 500);
  }

  async function buy() {
    if (!resolved?.wallet_address || phase === "preparing") return;
    setPhase("preparing");
    setErrMsg("");
    try {
      const data = await request<{ url: string }>("/api/v1/onramp/sign", {
        method: "POST",
        body: JSON.stringify({
          params: {
            currencyCode: "xrp",
            walletAddress: resolved.wallet_address,
            baseCurrencyCode: "usd",
          },
        }),
      });
      if (!data?.url) throw new Error("No checkout URL returned");
      openBrowser(data.url);
      setPhase("opened");
    } catch (e) {
      const detail =
        e instanceof ApiError
          ? ((e.body as { detail?: string } | null)?.detail ?? t("common.serverError", { status: e.status }))
          : e instanceof Error ? e.message : String(e);
      setErrMsg(typeof detail === "string" ? detail : t("buy.couldNotStart"));
      setPhase("error");
    }
  }

  return (
    <Shell>
      <Header account={account} />
      <h2 style={{ margin: "0 0 6px", fontSize: "1.2em" }}>{t("buy.title")}</h2>
      <p style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.85em", margin: "0 0 24px", lineHeight: 1.5 }}>
        {t("buy.intro")}
      </p>

      <Label>{t("buy.deliverToAlias")}</Label>
      <input
        value={alias}
        onChange={(e) => onAliasChange(e.target.value)}
        placeholder={t("send.aliasPlaceholder")}
        style={inputStyle}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
      />

      {resolved && (
        <div style={{ background: "var(--xapp-surface)", border: "1px solid var(--xapp-border)", borderRadius: 10, padding: "12px 14px", marginTop: 10, fontSize: "0.88em" }}>
          <Row label={t("buy.rowTo")} value={resolved.alias} />
          <Row label={t("buy.rowAddress")} value={resolved.wallet_address} mono />
        </div>
      )}
      {resolveErr && (
        <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "6px 0 0" }}>{resolveErr}</p>
      )}

      {phase === "opened" ? (
        <p style={{ color: "var(--xapp-success)", fontWeight: 600, fontSize: "0.88em", margin: "24px 0 0", textAlign: "center" }}>
          {t("buy.checkoutOpened", { alias: resolved?.alias ?? "" })}
        </p>
      ) : (
        <>
          {phase === "error" && (
            <p style={{ color: "var(--xapp-danger)", fontSize: "0.85em", margin: "14px 0 0" }}>{errMsg}</p>
          )}
          <Btn
            onClick={buy}
            disabled={!resolved || phase === "preparing"}
            active={!!resolved && phase !== "preparing"}
            purple
            style={{ marginTop: 24 }}
          >
            {phase === "preparing" ? t("buy.preparingCheckout") : t("buy.buyXrp")}
          </Btn>
        </>
      )}
    </Shell>
  );
}

function Header({ account }: { account: string }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <span style={{ fontWeight: 700, fontSize: "1.05em", letterSpacing: "-0.01em" }}>DNS://Money</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LangSwitcher />
        <span style={{ fontSize: "0.75em", background: "var(--xapp-surface-muted)", borderRadius: 20, padding: "3px 10px", opacity: 0.75, fontFamily: "monospace" }}>
          {shortAddr(account)}
        </span>
      </div>
    </header>
  );
}

function LangSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {SUPPORTED.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            aria-pressed={active}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              minWidth: 40,
              minHeight: 40,
              padding: "4px 6px",
              fontSize: "0.78em",
              fontWeight: active ? 700 : 400,
              color: active ? "var(--xapp-accent)" : "var(--xapp-text)",
              opacity: active ? 1 : 0.5,
            }}
          >
            {LOCALE_LABELS[loc]}
          </button>
        );
      })}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ position: "relative", zIndex: 1, maxWidth: 420, margin: "0 auto", padding: "16px 16px 48px", minHeight: "100vh", background: "transparent", color: "var(--xapp-text)", boxSizing: "border-box" }}>
      {children}
      <LegalFooter />
    </main>
  );
}

// Sign-request fallback shown on the signing step. The in-app postMessage
// bridge is the primary path, but if the host doesn't surface the request,
// these give the user a way to re-open it or hand off to Xaman via the
// deeplink (whose signature is still caught by the live websocket).
function SignFallback({ deeplink, onReopen, onDeeplink }: { uuid: string; deeplink: string | null; onReopen: () => void; onDeeplink?: () => void }) {
  const t = useT();
  return (
    <div style={{ marginTop: 28, padding: "14px 16px", border: "1px solid var(--xapp-border)", borderRadius: 12, background: "var(--xapp-surface)", textAlign: "center" }}>
      <p style={{ fontSize: "0.82em", color: "var(--xapp-text-muted)", opacity: 0.9, margin: "0 0 12px", lineHeight: 1.5 }}>
        {t("sign.notOpening")}
      </p>
      <Btn active onClick={onReopen}>{t("sign.reopen")}</Btn>
      {deeplink && (
        <button
          onClick={() => (onDeeplink ? onDeeplink() : openBrowser(deeplink))}
          style={{ display: "block", width: "100%", marginTop: 10, padding: "8px", background: "none", border: "none", color: "var(--xapp-accent)", fontSize: "0.82em", cursor: "pointer" }}
        >
          {t("sign.openInXaman")}
        </button>
      )}
    </div>
  );
}

// Footer links to the hosted Terms, Privacy, and Support pages — required for
// the public Xaman xApp listing. Opened in the device browser via the host.
function LegalFooter() {
  const t = useT();
  const SITE = "https://dnsofmoney.com";
  const linkStyle: React.CSSProperties = {
    background: "none", border: "none", color: "var(--xapp-text-muted)",
    opacity: 0.7, fontSize: "0.72em", cursor: "pointer", padding: 4, textDecoration: "underline",
  };
  const dot = <span style={{ opacity: 0.3, fontSize: "0.7em" }}>·</span>;
  return (
    <footer style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 36, paddingTop: 16, borderTop: "1px solid var(--xapp-surface-muted)" }}>
      <button style={linkStyle} onClick={() => openBrowser(`${SITE}/terms.html`)}>{t("legal.terms")}</button>
      {dot}
      <button style={linkStyle} onClick={() => openBrowser(`${SITE}/privacy.html`)}>{t("legal.privacy")}</button>
      {dot}
      <button style={linkStyle} onClick={() => openBrowser(`${SITE}/support.html`)}>{t("legal.support")}</button>
    </footer>
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
  const t = useT();
  return <CenteredMsg><span style={{ color: "var(--xapp-text-muted)", opacity: 0.85, fontSize: "0.9em" }}>{t("common.loading")}</span></CenteredMsg>;
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: "0.75em", fontWeight: 600, color: "var(--xapp-text-muted)", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0", ...style }}>
      {children}
    </p>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", gap: 8 }}>
      <span style={{ color: "var(--xapp-text-muted)", opacity: 0.85, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : undefined, fontSize: mono ? "0.9em" : undefined, textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

function Btn({ children, onClick, disabled, active, gold, purple, style }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  gold?: boolean;
  purple?: boolean;
  style?: React.CSSProperties;
}) {
  const activeBg = purple
    ? "linear-gradient(135deg, #7d00ff, #9b59ff)" // MoonPay brand purple
    : gold
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
