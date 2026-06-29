/**
 * Wire schemas for the A2A-041 Payment Hook — TS mirror of the Python `schemas`.
 * Plain interfaces (snake_case, matching the JSON wire contract) plus a
 * client-side validator that enforces the same rules as the Pydantic models.
 */

import { isValidPayUri } from "./addressing";

export interface A2APaymentHookRequest {
  job_id: string;
  provider_pay_address: string;
  requester_pay_address: string;
  amount: string | number;
  currency?: string;
  semantic_hash: string;
  receipt_ref?: string | null;
  /** Already-submitted XRPL tx for live read-only settlement (server-gated). */
  settlement_tx_hash?: string | null;
}

export interface ResolutionDetail {
  provider_address?: string | null;
  rail?: string | null;
  endpoint?: string | null;
}

export interface SettlementDetail {
  status: string;
  rail?: string | null;
  tx_ref?: string | null;
  amount: string | number;
  currency: string;
  failure_reason?: string | null;
}

export interface A2APaymentHookResponse {
  hook_id: string;
  job_id: string;
  resolution: ResolutionDetail;
  settlement_result: SettlementDetail;
  iso_message_ref?: string | null;
  created_at: string;
}

export interface A2ACapabilities {
  binding_version: string;
  supported_schemes: string[];
  protocol_versions: string[];
}

/** Validate a request the way the server's Pydantic validators do. Throws on bad input. */
export function validatePaymentHookRequest(req: A2APaymentHookRequest): void {
  for (const field of ["provider_pay_address", "requester_pay_address"] as const) {
    if (!isValidPayUri(req[field])) {
      throw new Error(`Invalid pay: URI format: ${req[field]}`);
    }
  }
  if (!req.semantic_hash || !req.semantic_hash.trim()) {
    throw new Error("semantic_hash must not be empty");
  }
}
