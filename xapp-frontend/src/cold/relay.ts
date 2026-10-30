// Client for the cold vault relay (see ap4m-hackathon/cold-xapp). The relay is NOT the FAS backend: it has its own
// URL and its own bearer token, so it does not go through useApiClient.
//
// The vault token never touches localStorage or sessionStorage (Xaman listing rule). It lives in this module's memory
// and is gone when the xApp closes. The owner pairs again with a fresh code from the desktop bridge.

export const COLD_RELAY_URL: string = (import.meta.env.VITE_COLD_RELAY_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
export const COLD_ENABLED = COLD_RELAY_URL.length > 0;

export type Vault = { id: string; token: string; address: string };

export type ColdStatus = "QUEUED" | "PENDING_APPROVAL" | "APPROVED" | "CONFIRMED" | "REJECTED" | "FAILED" | "EXPIRED";

export type ColdRequest = {
  id: string;
  status: ColdStatus;
  to: string;
  amountXrp: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  txHash: string | null;
  error: string | null;
};

export class RelayError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(`relay ${status} ${code}`);
    this.name = "RelayError";
  }
}

let vault: Vault | null = null;
export const vaultStore = {
  get: (): Vault | null => vault,
  set: (v: Vault) => { vault = v; },
  clear: () => { vault = null; },
};

async function call<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  if (!COLD_ENABLED) throw new RelayError(0, "NOT_CONFIGURED");
  let res: Response;
  try {
    res = await fetch(COLD_RELAY_URL + path, {
      method: init.method ?? "GET",
      headers: {
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new RelayError(0, "NETWORK");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new RelayError(res.status, json.error ?? "ERROR");
  return json as T;
}

export const ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
export const AMOUNT_RE = /^(0|[1-9]\d{0,10})(\.\d{1,6})?$/;

export async function claimCode(code: string): Promise<Vault> {
  const r = await call<{ vaultId: string; token: string; address: string }>("/pair/claim", { method: "POST", body: { code: code.trim() } });
  const v = { id: r.vaultId, token: r.token, address: r.address };
  vaultStore.set(v);
  return v;
}

export function createRequest(v: Vault, to: string, amountXrp: string, note: string): Promise<ColdRequest> {
  return call<ColdRequest>(`/vaults/${encodeURIComponent(v.id)}/requests`, { method: "POST", token: v.token, body: { to, amountXrp, note } });
}

export async function listRequests(v: Vault): Promise<ColdRequest[]> {
  return (await call<{ requests: ColdRequest[] }>(`/vaults/${encodeURIComponent(v.id)}/requests`, { token: v.token })).requests;
}
