import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { useApiClient, ApiError } from "../api/client";
import {
  ADDRESS_RE, AMOUNT_RE, RelayError, claimCode, createRequest, listRequests, vaultStore,
  type ColdRequest, type ColdStatus, type Vault,
} from "./relay";

// Cold tab: ask a desktop Ledger to pay. The phone holds no key for the vault account. This tab never opens a Xaman
// sign request. It queues a request at the relay, and the owner approves it on the Ledger at the desktop.
// No timers poll the relay: status is read on open, when the app returns to the foreground, and on "Check status".

type PreviewData = { destination_address: string | null };

const box: React.CSSProperties = {
  background: "var(--xapp-surface)", borderRadius: 12, padding: 14, marginBottom: 14,
  border: "1px solid var(--xapp-surface-muted)",
};
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 10,
  border: "1px solid var(--xapp-surface-muted)", background: "var(--xapp-surface)",
  color: "var(--xapp-text)", fontSize: "1em", outline: "none", WebkitAppearance: "none",
};
const label: React.CSSProperties = { display: "block", margin: "12px 0 6px", color: "var(--xapp-text-muted)", fontSize: "1em" };

function Button({ children, onClick, disabled, quiet }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; quiet?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block", width: "100%", padding: 14, borderRadius: 12, border: "none", marginTop: 14,
        background: quiet || disabled ? "var(--xapp-surface-muted)" : "linear-gradient(135deg, var(--xapp-accent), var(--xapp-accent-light))",
        color: quiet || disabled ? "var(--xapp-text)" : "#0a0619",
        fontSize: "1em", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

const short = (a: string) => (a.length <= 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`);
const FINAL: ColdStatus[] = ["CONFIRMED", "REJECTED", "FAILED", "EXPIRED"];

export default function ColdScreen() {
  const t = useT();
  const { request } = useApiClient();
  const [vault, setVault] = useState<Vault | null>(vaultStore.get());

  // pairing
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairErr, setPairErr] = useState("");

  // new request
  const [to, setTo] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const [toErr, setToErr] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");

  // requests
  const [items, setItems] = useState<ColdRequest[]>([]);
  const [checkN, setCheckN] = useState(0);
  const [listErr, setListErr] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const forget = useCallback(() => {
    vaultStore.clear();
    setVault(null);
    setItems([]);
    setPairErr("");
  }, []);

  const failFrom = useCallback((e: unknown): string => {
    if (e instanceof RelayError) {
      if (e.status === 401) return "reauth";
      if (e.code === "BAD_CODE") return t("cold.badCode");
      if (e.code === "LOCKED") return t("cold.locked");
      if (e.code === "TOO_MANY_OPEN") return t("cold.tooManyOpen");
      if (e.code === "BAD_INPUT") return t("cold.badInput");
      if (e.code === "NETWORK") return t("cold.network");
    }
    return t("cold.generic");
  }, [t]);

  // Read the request list: once on open, when the app comes back to the foreground, and on the button. No timers.
  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    const load = async () => {
      try {
        const list = await listRequests(vault);
        if (!cancelled) { setItems(list); setListErr(""); }
      } catch (e) {
        if (cancelled) return;
        const m = failFrom(e);
        if (m === "reauth") { forget(); setPairErr(t("cold.sessionEnded")); } else setListErr(m);
      }
    };
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    void load();
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, [vault, checkN, failFrom, forget, t]);

  async function pair() {
    if (pairing || !/^\d{8}$/.test(code.trim())) return;
    setPairing(true);
    setPairErr("");
    try {
      const v = await claimCode(code);
      setVault(v);
      setCode("");
    } catch (e) {
      setPairErr(failFrom(e));
    } finally {
      setPairing(false);
    }
  }

  function onToChange(value: string) {
    setTo(value);
    setResolved(null);
    setToErr("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const v = value.trim();
    if (ADDRESS_RE.test(v)) { setResolved(v); return; }
    if (!/^pay:/i.test(v) || v.length < 5) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await request<PreviewData>(`/api/v1/send/preview/${encodeURIComponent(v)}`, { method: "GET" });
        if (data.destination_address && ADDRESS_RE.test(data.destination_address)) setResolved(data.destination_address);
        else setToErr(t("cold.aliasNoAddress"));
      } catch (e) {
        setToErr(e instanceof ApiError && e.status === 404 ? t("cold.aliasNotFound") : t("cold.couldNotResolve"));
      }
    }, 600);
  }

  const amountOk = AMOUNT_RE.test(amount) && Number(amount) > 0;
  const toOk = resolved !== null && resolved !== vault?.address;
  const noteOk = note.length <= 100;
  const canSend = !!vault && amountOk && toOk && noteOk && !sending;

  async function submit() {
    if (!vault || !canSend || !resolved) return;
    setSending(true);
    setSendErr("");
    try {
      const r = await createRequest(vault, resolved, amount, note.trim());
      setItems((prev) => [r, ...prev]);
      setTo(""); setResolved(null); setAmount(""); setNote("");
    } catch (e) {
      const m = failFrom(e);
      if (m === "reauth") { forget(); setPairErr(t("cold.sessionEnded")); } else setSendErr(m);
    } finally {
      setSending(false);
    }
  }

  if (!vault) {
    return (
      <div className="cold-screen" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 8px" }}>{t("cold.title")}</h2>
        <p style={{ margin: "0 0 14px", lineHeight: 1.5 }}>{t("cold.intro")}</p>
        <div style={box}>
          <label htmlFor="cold-code" style={{ ...label, marginTop: 0 }}>{t("cold.codeLabel")}</label>
          <input
            id="cold-code"
            style={{ ...input, letterSpacing: "0.2em", fontFamily: "monospace" }}
            value={code}
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            placeholder="00000000"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {pairErr && <p style={{ color: "var(--xapp-danger)", margin: "10px 0 0" }}>{pairErr}</p>}
          <Button onClick={pair} disabled={pairing || code.length !== 8}>{pairing ? t("cold.pairing") : t("cold.pair")}</Button>
        </div>
        <p style={{ color: "var(--xapp-text-muted)", margin: 0, lineHeight: 1.5 }}>{t("cold.pairHelp")}</p>
      </div>
    );
  }

  return (
    <div className="cold-screen" style={{ padding: 20 }}>
      <h2 style={{ margin: "0 0 8px" }}>{t("cold.title")}</h2>
      <div style={box}>
        <div style={{ color: "var(--xapp-text-muted)" }}>{t("cold.vault")}</div>
        <div style={{ fontFamily: "monospace", wordBreak: "break-all", margin: "4px 0 8px" }}>{vault.address}</div>
        <div style={{ color: "var(--xapp-text-muted)", lineHeight: 1.5 }}>{t("cold.onlyLedger")}</div>
      </div>

      <div style={box}>
        <label htmlFor="cold-to" style={{ ...label, marginTop: 0 }}>{t("cold.to")}</label>
        <input id="cold-to" style={input} value={to} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="pay:name / r…" onChange={(e) => onToChange(e.target.value)} />
        {resolved && <div style={{ fontFamily: "monospace", wordBreak: "break-all", marginTop: 6 }}>{resolved}</div>}
        {resolved === vault.address && <p style={{ color: "var(--xapp-danger)", margin: "6px 0 0" }}>{t("cold.toSelf")}</p>}
        {toErr && <p style={{ color: "var(--xapp-danger)", margin: "6px 0 0" }}>{toErr}</p>}

        <label htmlFor="cold-amount" style={label}>{t("cold.amount")}</label>
        <input id="cold-amount" style={input} value={amount} inputMode="decimal" autoComplete="off" placeholder="0.0" onChange={(e) => setAmount(e.target.value.trim())} />
        {amount !== "" && !amountOk && <p style={{ color: "var(--xapp-danger)", margin: "6px 0 0" }}>{t("cold.amountBad")}</p>}

        <label htmlFor="cold-note" style={label}>{t("cold.note")}</label>
        <input id="cold-note" style={input} value={note} maxLength={100} autoComplete="off" onChange={(e) => setNote(e.target.value)} />
        <div style={{ color: "var(--xapp-text-muted)", marginTop: 6 }}>{t("cold.noteHelp")}</div>

        {sendErr && <p style={{ color: "var(--xapp-danger)", margin: "10px 0 0" }}>{sendErr}</p>}
        <Button onClick={submit} disabled={!canSend}>{sending ? t("cold.sending") : t("cold.send")}</Button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
        <h3 style={{ margin: 0 }}>{t("cold.requests")}</h3>
      </div>
      {listErr && <p style={{ color: "var(--xapp-danger)", margin: "0 0 8px" }}>{listErr}</p>}
      {items.length === 0 && <p style={{ color: "var(--xapp-text-muted)", margin: 0 }}>{t("cold.empty")}</p>}
      {items.map((r) => (
        <div key={r.id} style={box}>
          <div style={{ fontWeight: 700 }}>{r.amountXrp} XRP → {short(r.to)}</div>
          <div style={{ margin: "6px 0", color: FINAL.includes(r.status) && r.status !== "CONFIRMED" ? "var(--xapp-danger)" : "var(--xapp-text)" }}>
            {t(`cold.status.${r.status}`)}
          </div>
          {r.note && <div style={{ color: "var(--xapp-text-muted)" }}>{r.note}</div>}
          {r.status === "CONFIRMED" && r.txHash && <div style={{ fontFamily: "monospace", wordBreak: "break-all", marginTop: 6 }}>{r.txHash}</div>}
          {r.status === "FAILED" && r.error && <div style={{ color: "var(--xapp-text-muted)", marginTop: 6 }}>{t("cold.failedWhy")}</div>}
        </div>
      ))}
      <Button quiet onClick={() => setCheckN((n) => n + 1)}>{t("cold.check")}</Button>
      <Button quiet onClick={forget}>{t("cold.forget")}</Button>
    </div>
  );
}
