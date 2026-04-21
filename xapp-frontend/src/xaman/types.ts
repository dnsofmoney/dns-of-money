// Shared types for the Xaman session layer.
// Mirrors the OTT response shape documented by XRPL Labs at
// https://docs.xaman.dev/xapps/building-an-xapp/ott-one-time-token-data

export type XamanNetwork =
  | "MAINNET"
  | "TESTNET"
  | "DEVNET"
  | "XAHAU"
  | "XAHAU_TESTNET";

export type XappStyle = "LIGHT" | "DARK" | "MOONLIGHT" | "ROYAL";

/**
 * The OTT context returned by Xaman's /platform/xapp/ott/{token} endpoint.
 * The backend proxies this to the frontend alongside our own JWT, so we
 * never touch the Xaman API secret from the browser.
 */
export interface OttContext {
  /** r-address of the signed-in Xaman user. */
  account: string;
  accountType: "REGULAR" | "READONLY";
  network: XamanNetwork;
  /** WebSocket endpoint for the user's selected network, e.g. wss://xrplcluster.com */
  networkEndpoint: string;
  locale: string;
  style: XappStyle;
  /** Xaman app version string. */
  version: string;
  /** Same as networkEndpoint — kept for API-compat with Xaman docs. */
  nodewss: string;
}

export interface XamanSession {
  /** Raw OTT. Used once on boot for the backend exchange, then ignored. */
  ott: string;
  /** Our backend's JWT, 24h TTL. Attached to every API call via useApiClient. */
  jwt: string;
  context: OttContext;
}

export interface SignRequestResult {
  signed: boolean;
  txid?: string;
  payload_uuidv4: string;
  /** "REJECTED" | "EXPIRED" | etc. when signed === false. */
  reason?: string;
}
