/**
 * DNS of Money SDK — TypeScript client.
 *
 * Resolve, register, and check availability of pay: aliases.
 * Uses only the built-in fetch() API — no external dependencies.
 *
 * Usage:
 *   import { DNSOfMoneyClient } from "dnsofmoney";
 *
 *   const client = new DNSOfMoneyClient({ apiKey: "fas_live_..." });
 *   const result = await client.resolve("pay:vendor.alpha");
 */

import {
  AliasNotFoundError,
  AliasTakenError,
  AuthenticationError,
  CapReachedError,
  DNSOfMoneyError,
  RateLimitError,
} from "./exceptions";
import type {
  Compliance,
  Endpoint,
  Entity,
  Identity,
  RegistrationResponse,
  ResolutionResponse,
} from "./models";

const DEFAULT_BASE_URL = "https://api.dnsofmoney.com";

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export class DNSOfMoneyClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? 10_000;
  }

  /**
   * Resolve a pay: alias to payment credentials.
   *
   * No API key required for public aliases. Authenticated callers
   * receive higher-tier responses with additional fields.
   *
   * @param aliasUri - A FAS-1 pay: URI (e.g., "pay:vendor.alpha").
   * @throws {AliasNotFoundError} If the alias does not exist.
   */
  async resolve(aliasUri: string): Promise<ResolutionResponse> {
    const raw = await this.get(`/resolve/${aliasUri}`);
    const data = raw.success !== undefined ? (raw.data ?? raw) : raw;
    return parseResolution(data);
  }

  /**
   * Register a new pay: alias.
   *
   * Requires API key. The alias must not already be taken or reserved.
   *
   * @throws {AliasTakenError} If the alias is already registered.
   * @throws {CapReachedError} If the founding tier cap has been reached.
   * @throws {AuthenticationError} If the API key is missing or invalid.
   */
  async register(
    aliasName: string,
    displayName: string,
    preferredRail: string,
    extra: Record<string, unknown> = {}
  ): Promise<RegistrationResponse> {
    const body = {
      alias_name: aliasName,
      display_name: displayName,
      preferred_rail: preferredRail,
      ...extra,
    };
    const data = await this.post("/v1/aliases", body);
    return {
      alias_name: data.alias_name ?? aliasName,
      registration_number: data.registration_number,
      anchor_status: data.anchor_status,
      proof: data.proof,
      created_at: data.created_at,
    };
  }

  /**
   * Check if a pay: alias is available to register.
   *
   * No API key required.
   *
   * @returns true if available, false if taken or reserved.
   */
  async checkAvailability(aliasName: string): Promise<boolean> {
    const data = await this.get(`/v1/aliases/check/${aliasName}`);
    return data.status === "available";
  }

  // ── Internal HTTP helpers ─────────────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      h["X-API-Key"] = this.apiKey;
    }
    return h;
  }

  private async get(path: string): Promise<Record<string, any>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const resp = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: this.headers(),
        signal: controller.signal,
      });
      return this.handleResponse(resp);
    } finally {
      clearTimeout(timer);
    }
  }

  private async post(
    path: string,
    body: Record<string, unknown>
  ): Promise<Record<string, any>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const resp = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return this.handleResponse(resp);
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse(
    resp: Response
  ): Promise<Record<string, any>> {
    if (resp.ok) {
      return resp.json();
    }

    let body: Record<string, any> = {};
    try {
      body = await resp.json();
    } catch {
      // non-JSON error body — ignore
    }

    const errorCode = body.error_code ?? "";
    const detail = body.detail ?? "";

    if (resp.status === 401) throw new AuthenticationError();
    if (resp.status === 404) throw new AliasNotFoundError(detail || "unknown alias");
    if (resp.status === 409) {
      if (errorCode === "CAP_EXCEEDED") throw new CapReachedError();
      throw new AliasTakenError(detail || "alias taken");
    }
    if (resp.status === 429) {
      throw new RateLimitError(body.retry_after);
    }

    throw new DNSOfMoneyError(
      `HTTP ${resp.status}: ${resp.statusText}`,
      resp.status
    );
  }
}

// ── Module-level convenience functions ────────────────────────────────────

/**
 * Resolve a pay: alias. See DNSOfMoneyClient.resolve for full docs.
 */
export async function resolve(
  aliasUri: string,
  apiKey?: string,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<ResolutionResponse> {
  return new DNSOfMoneyClient({ apiKey, baseUrl }).resolve(aliasUri);
}

/**
 * Register a pay: alias. See DNSOfMoneyClient.register for full docs.
 */
export async function register(
  aliasName: string,
  displayName: string,
  preferredRail: string,
  apiKey: string,
  baseUrl: string = DEFAULT_BASE_URL,
  extra: Record<string, unknown> = {}
): Promise<RegistrationResponse> {
  return new DNSOfMoneyClient({ apiKey, baseUrl }).register(
    aliasName,
    displayName,
    preferredRail,
    extra
  );
}

/**
 * Check alias availability. See DNSOfMoneyClient.checkAvailability for full docs.
 */
export async function checkAvailability(
  aliasName: string,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<boolean> {
  return new DNSOfMoneyClient({ baseUrl }).checkAvailability(aliasName);
}

// ── Response parsing ──────────────────────────────────────────────────────

function parseResolution(data: Record<string, any>): ResolutionResponse {
  // Entity — may be nested object or top-level fields
  let entity: Entity | undefined;
  if (data.entity) {
    entity = {
      display_name: data.entity.display_name ?? "",
      entity_type: data.entity.entity_type,
      jurisdiction: data.entity.jurisdiction,
      kyc_status: data.entity.kyc_status,
    };
  } else if (data.display_name) {
    entity = {
      display_name: data.display_name ?? "",
      entity_type: data.entity_type,
    };
  }

  // Endpoints — handle both flat array and preferred_endpoint + fallback
  const endpoints: Endpoint[] = [];
  if (data.preferred_endpoint) {
    const ep = data.preferred_endpoint;
    endpoints.push({
      rail: ep.rail_type ?? ep.rail ?? "",
      currency: ep.currency ?? "USD",
      address: ep.address,
      priority: ep.priority ?? 1,
      fee_estimate: ep.fee_estimate,
      settlement_latency: ep.settlement_latency,
      routing_metadata: ep.routing_metadata,
    });
    for (const fb of data.fallback_endpoints ?? []) {
      endpoints.push({
        rail: fb.rail_type ?? fb.rail ?? "",
        currency: fb.currency ?? "USD",
        address: fb.address,
        priority: fb.priority ?? 2,
        fee_estimate: fb.fee_estimate,
        settlement_latency: fb.settlement_latency,
        routing_metadata: fb.routing_metadata,
      });
    }
  } else {
    for (const ep of data.endpoints ?? []) {
      endpoints.push({
        rail: ep.rail ?? "",
        currency: ep.currency ?? "USD",
        address: ep.address,
        priority: ep.priority ?? 1,
        fee_estimate: ep.fee_estimate,
        settlement_latency: ep.settlement_latency,
        routing_metadata: ep.routing_metadata,
      });
    }
  }

  // Compliance
  let compliance: Compliance | undefined;
  if (data.compliance) {
    const c = data.compliance;
    compliance = {
      sanctions_checked: c.sanctions_checked ?? c.screened ?? false,
      fatf_risk_rating: c.fatf_risk_rating,
      requires_purpose_code: c.requires_purpose_code ?? false,
      screened: c.screened,
      result: c.result,
      provider: c.provider,
      screened_at: c.screened_at,
      cached: c.cached,
    };
  }

  // Identity (NFT + generative art)
  let identity: Identity | undefined;
  if (data.identity) {
    const i = data.identity;
    identity = {
      nft_token_id: i.nft_token_id,
      image_uri: i.image_uri,
      metadata_uri: i.metadata_uri,
      image_url: i.image_url,
      nft_explorer_url: i.nft_explorer_url,
      generation: i.generation,
      identity_status: i.identity_status,
      tier: i.tier,
    };
  }

  return {
    resolution_id: data.resolution_id ?? "",
    alias_uri: data.alias ?? "",
    resolved_at: data.resolved_at ?? "",
    ttl_seconds: data.ttl_seconds ?? 300,
    message_id: data.message_id,
    entity_id: data.entity_id,
    entity,
    endpoints,
    compliance,
    iso20022_hint: data.iso20022_hint,
    identity,
    rail_score: data.rail_score,
    resolution_status: data.status ?? data.resolution_status ?? "resolved",
    caller_tier: data.caller_tier,
    resolved_from: data.resolved_from ?? "origin",
    cache_hit: data.cache_hit ?? false,
    agent_commerce: data.agent_commerce,
    warnings: data.warnings ?? [],
  };
}
