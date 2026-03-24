/**
 * Resolve a pay: alias using the DNS of Money API.
 *
 * pay: aliases are human-readable financial addresses defined by FAS-1.
 * They resolve to payment endpoints across multiple rails (ACH, FedNow,
 * XRPL, SWIFT) — like DNS for payments.
 *
 * This example uses the built-in fetch() API — no external dependencies.
 *
 * Usage:
 *   npx tsx resolve.ts
 *   API_KEY=your_key npx tsx resolve.ts
 */

const BASE_URL = "https://api.dnsofmoney.com";
const ALIAS = "pay:vendor.alpha";

// --- Types ---

interface PaymentEndpoint {
  rail: "ach" | "fednow" | "swift" | "xrpl" | "solana" | "card";
  currency: string;
  priority: number;
  fee_estimate?: string;
  settlement_latency?: string;
  routing_metadata?: Record<string, unknown>;
}

interface Entity {
  display_name: string;
  entity_type: string;
  tier?: "founding" | "standard" | "enterprise";
  jurisdiction?: string;
}

interface ISO20022Hint {
  message_type: string;
  service_level?: string;
  local_instrument?: string;
  charge_bearer?: string;
}

interface Compliance {
  status: "clear" | "pending" | "blocked";
  screened_at?: string;
  travel_rule_required?: boolean;
}

interface ResolutionResponse {
  alias: string;
  resolved: boolean;
  entity?: Entity;
  preferred_rail?: string;
  endpoints: PaymentEndpoint[];
  iso20022_hint?: ISO20022Hint;
  compliance?: Compliance;
  ttl_seconds: number;
  resolved_at: string;
  resolution_status?: "resolved" | "partial" | "failed";
  caller_tier?: number;
  resolved_from?: "origin" | "cache";
  error_code?: string;
}

// --- Resolve ---

async function resolve(
  alias: string,
  apiKey?: string
): Promise<ResolutionResponse> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const resp = await fetch(`${BASE_URL}/resolve/${alias}`, { headers });

  // Handle 404 — alias not found
  if (resp.status === 404) {
    const body = await resp.json();
    throw new Error(`Alias not found: ${alias} (${body.detail ?? "ALIAS_NOT_FOUND"})`);
  }

  // Handle 403 — compliance blocked
  if (resp.status === 403) {
    const body = await resp.json();
    throw new Error(`Resolution blocked: ${body.detail ?? "COMPLIANCE_BLOCKED"}`);
  }

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  return resp.json();
}

// --- Main ---

async function main() {
  const apiKey = process.env.API_KEY;

  console.log(`Resolving ${ALIAS} ...`);

  try {
    const data = await resolve(ALIAS, apiKey);

    // Entity info
    const entity = data.entity;
    console.log(`\nEntity:         ${entity?.display_name ?? "N/A"}`);
    console.log(`Entity type:    ${entity?.entity_type ?? "N/A"}`);

    // Preferred rail
    console.log(`Preferred rail: ${data.preferred_rail ?? "N/A"}`);

    // ISO 20022 hint
    console.log(`ISO 20022 hint: ${data.iso20022_hint?.message_type ?? "N/A"}`);

    // Endpoints
    console.log(`\nEndpoints (${data.endpoints.length}):`);
    for (const ep of data.endpoints) {
      console.log(
        `  [${ep.priority}] ${ep.rail} (${ep.currency ?? "USD"}) — fee: ${ep.fee_estimate ?? "N/A"}`
      );
    }

    // Cache info
    console.log(`\nCache TTL:   ${data.ttl_seconds}s`);
    console.log(`Resolved at: ${data.resolved_at}`);
    console.log(`Served from: ${data.resolved_from ?? "unknown"}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
