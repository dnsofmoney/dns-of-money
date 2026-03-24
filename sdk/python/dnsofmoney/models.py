"""DNS of Money SDK — response models (stdlib only, no external deps)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Entity:
    """The entity (person, business, agent) that owns a pay: alias."""

    display_name: str
    entity_type: Optional[str] = None
    jurisdiction: Optional[str] = None
    kyc_status: Optional[str] = None


@dataclass
class Endpoint:
    """A single payment endpoint returned by resolution."""

    rail: str
    currency: str
    address: Optional[str] = None
    priority: int = 1
    fee_estimate: Optional[str] = None
    settlement_latency: Optional[str] = None
    routing_metadata: Optional[dict[str, Any]] = None


@dataclass
class Compliance:
    """Compliance screening result attached to a resolution."""

    sanctions_checked: bool = False
    fatf_risk_rating: Optional[str] = None
    requires_purpose_code: bool = False
    screened: Optional[bool] = None
    result: Optional[str] = None
    provider: Optional[str] = None
    screened_at: Optional[str] = None
    cached: Optional[bool] = None


@dataclass
class Identity:
    """On-chain identity linked to a pay: alias (NFT + generative art)."""

    nft_token_id: Optional[str] = None
    image_uri: Optional[str] = None
    metadata_uri: Optional[str] = None
    image_url: Optional[str] = None
    nft_explorer_url: Optional[str] = None
    generation: Optional[int] = None
    identity_status: Optional[str] = None
    tier: Optional[str] = None


@dataclass
class AgentCard:
    """AP2/A2A-003 agent capability manifest."""

    name: str
    endpoint: str
    capabilities: list[str] = field(default_factory=list)
    authentication: Optional[str] = None
    domains: list[str] = field(default_factory=list)
    protocol_versions: list[str] = field(default_factory=list)


@dataclass
class ResolutionResponse:
    """Full resolution response from the DNS of Money API."""

    resolution_id: str
    alias_uri: str
    resolved_at: str
    ttl_seconds: int = 300
    message_id: Optional[str] = None
    entity_id: Optional[str] = None
    entity: Optional[Entity] = None
    endpoints: list[Endpoint] = field(default_factory=list)
    compliance: Optional[Compliance] = None
    iso20022_hint: Optional[dict[str, Any]] = None
    identity: Optional[Identity] = None
    rail_score: Optional[dict[str, Any]] = None
    resolution_status: str = "resolved"
    caller_tier: Optional[int] = None
    resolved_from: str = "origin"
    cache_hit: bool = False
    agent_commerce: Optional[dict[str, Any]] = None
    warnings: list[str] = field(default_factory=list)


@dataclass
class RegistrationResponse:
    """Response from a successful alias registration."""

    alias_name: str
    registration_number: Optional[int] = None
    anchor_status: Optional[str] = None
    proof: Optional[dict[str, Any]] = None
    created_at: Optional[str] = None
