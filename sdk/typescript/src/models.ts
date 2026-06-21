/** The entity (person, business, agent) that owns a pay: alias. */
export interface Entity {
  display_name: string;
  entity_type?: string;
  jurisdiction?: string;
  kyc_status?: string;
}

/** A single payment endpoint returned by resolution. */
export interface Endpoint {
  rail: string;
  currency: string;
  address?: string;
  priority: number;
  fee_estimate?: string;
  settlement_latency?: string;
  routing_metadata?: Record<string, unknown>;
}

/** Compliance screening result attached to a resolution. */
export interface Compliance {
  sanctions_checked: boolean;
  fatf_risk_rating?: string;
  requires_purpose_code: boolean;
  screened?: boolean;
  result?: string;
  provider?: string;
  screened_at?: string;
  cached?: boolean;
}

/** On-chain identity linked to a pay: alias (NFT + generative art). */
export interface Identity {
  nft_token_id?: string;
  image_uri?: string;
  metadata_uri?: string;
  image_url?: string;
  nft_explorer_url?: string;
  generation?: number;
  identity_status?: string;
  tier?: string;
}

/** AP2/A2A-003 agent capability manifest. */
export interface AgentCard {
  name: string;
  endpoint: string;
  capabilities: string[];
  authentication?: string;
  domains: string[];
  protocol_versions: string[];
}

/** Full resolution response from the DNS of Money API. */
export interface ResolutionResponse {
  resolution_id: string;
  alias_uri: string;
  resolved_at: string;
  ttl_seconds: number;
  message_id?: string;
  entity_id?: string;
  entity?: Entity;
  endpoints: Endpoint[];
  compliance?: Compliance;
  iso20022_hint?: Record<string, unknown>;
  identity?: Identity;
  rail_score?: Record<string, unknown>;
  resolution_status: string;
  caller_tier?: number;
  resolved_from: string;
  cache_hit: boolean;
  agent_commerce?: Record<string, unknown>;
  warnings: string[];
}

/** Response from a successful alias registration. */
export interface RegistrationResponse {
  alias_name: string;
  registration_number?: number;
  anchor_status?: string;
  proof?: Record<string, unknown>;
  created_at?: string;
}

/** Preview of where a payment would go (dry-run, no execution). */
export interface SendPreview {
  alias: string;
  resolved: boolean;
  destination_address?: string;
  display_name?: string;
  rail?: string;
  currency: string;
  fee_estimate?: string;
  identity?: Record<string, unknown>;
}

/** Result of a send-to-alias payment execution. */
export interface SendResult {
  transaction_id: string;
  status: string;
  alias: string;
  amount: number;
  currency: string;
  rail: string;
  tx_hash?: string;
  settle_time_seconds?: number;
  memo?: string;
  created_at?: string;
}

/** Optional parameters for a send-to-alias payment. */
export interface SendOptions {
  currency?: string;
  memo?: string;
  /** Unique key to prevent double-send. Auto-generated if not provided. */
  idempotencyKey?: string;
}
