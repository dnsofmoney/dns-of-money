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
  entity?: Entity;
  endpoints: Endpoint[];
  compliance?: Compliance;
  iso20022_hint?: Record<string, unknown>;
  resolution_status: string;
  caller_tier?: number;
  resolved_from: string;
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
