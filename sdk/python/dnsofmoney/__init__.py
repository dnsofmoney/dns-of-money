"""DNS of Money Python SDK — resolve, register, and send to pay: aliases."""

from .client import (
    DNSOfMoneyClient,
    check_availability,
    register,
    resolve,
    send,
    send_preview,
)
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
    SendPreview,
    SendResult,
)

__all__ = [
    "DNSOfMoneyClient",
    "resolve",
    "register",
    "check_availability",
    "send_preview",
    "send",
    "DNSOfMoneyError",
    "AliasNotFoundError",
    "AliasTakenError",
    "AuthenticationError",
    "RateLimitError",
    "CapReachedError",
    "ResolutionResponse",
    "RegistrationResponse",
    "SendPreview",
    "SendResult",
    "Entity",
    "Endpoint",
    "Compliance",
    "Identity",
    "AgentCard",
]

__version__ = "0.4.0"
