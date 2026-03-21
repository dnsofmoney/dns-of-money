/** Base error for all DNS of Money SDK errors. */
export class DNSOfMoneyError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "DNSOfMoneyError";
    this.statusCode = statusCode;
  }
}

/** Raised when a pay: alias does not exist (HTTP 404). */
export class AliasNotFoundError extends DNSOfMoneyError {
  constructor(alias: string) {
    super(`Alias not found: ${alias}`, 404);
    this.name = "AliasNotFoundError";
  }
}

/** Raised when a pay: alias is already registered (HTTP 409). */
export class AliasTakenError extends DNSOfMoneyError {
  constructor(alias: string) {
    super(`Alias already taken: ${alias}`, 409);
    this.name = "AliasTakenError";
  }
}

/** Raised when the API key is missing or invalid (HTTP 401). */
export class AuthenticationError extends DNSOfMoneyError {
  constructor() {
    super("Invalid or missing API key", 401);
    this.name = "AuthenticationError";
  }
}

/** Raised when the API rate limit is exceeded (HTTP 429). */
export class RateLimitError extends DNSOfMoneyError {
  readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    const msg = retryAfter
      ? `Rate limit exceeded — retry after ${retryAfter}s`
      : "Rate limit exceeded";
    super(msg, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Raised when the founding tier cap (500) has been reached. */
export class CapReachedError extends DNSOfMoneyError {
  constructor() {
    super("Founding tier cap reached (500/500)", 409);
    this.name = "CapReachedError";
  }
}
