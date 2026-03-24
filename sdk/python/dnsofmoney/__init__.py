"""DNS of Money Python SDK — resolve and register pay: aliases."""

from .client import DNSOfMoneyClient, check_availability, register, resolve
from .exceptions import (
    AliasNotFoundError,
    AliasTakenError,
    AuthenticationError,
    CapReachedError,
    DNSOfMoneyError,
    RateLimitError,
)
from .models import (
    AgentCard,
    Compliance,
    Endpoint,
    Entity,
    Identity,
    RegistrationResponse,
    ResolutionResponse,
)

__all__ = [
    "DNSOfMoneyClient",
    "resolve",
    "register",
    "check_availability",
    "DNSOfMoneyError",
    "AliasNotFoundError",
    "AliasTakenError",
    "AuthenticationError",
    "RateLimitError",
    "CapReachedError",
    "ResolutionResponse",
    "RegistrationResponse",
    "Entity",
    "Endpoint",
    "Compliance",
    "Identity",
    "AgentCard",
]

__version__ = "0.3.0"
