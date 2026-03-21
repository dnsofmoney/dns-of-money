"""DNS of Money SDK — exception hierarchy."""


class DNSOfMoneyError(Exception):
    """Base exception for all DNS of Money SDK errors."""

    def __init__(self, message: str, status_code: int | None = None):
        self.status_code = status_code
        super().__init__(message)


class AliasNotFoundError(DNSOfMoneyError):
    """Raised when a pay: alias does not exist (HTTP 404)."""

    def __init__(self, alias: str):
        super().__init__(f"Alias not found: {alias}", status_code=404)


class AliasTakenError(DNSOfMoneyError):
    """Raised when a pay: alias is already registered (HTTP 409)."""

    def __init__(self, alias: str):
        super().__init__(f"Alias already taken: {alias}", status_code=409)


class AuthenticationError(DNSOfMoneyError):
    """Raised when the API key is missing or invalid (HTTP 401)."""

    def __init__(self):
        super().__init__("Invalid or missing API key", status_code=401)


class RateLimitError(DNSOfMoneyError):
    """Raised when the API rate limit is exceeded (HTTP 429)."""

    def __init__(self, retry_after: int | None = None):
        self.retry_after = retry_after
        msg = "Rate limit exceeded"
        if retry_after:
            msg += f" — retry after {retry_after}s"
        super().__init__(msg, status_code=429)


class CapReachedError(DNSOfMoneyError):
    """Raised when the founding tier cap (500) has been reached."""

    def __init__(self):
        super().__init__("Founding tier cap reached (500/500)", status_code=409)
