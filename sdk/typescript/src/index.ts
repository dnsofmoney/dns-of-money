export {
  DNSOfMoneyClient,
  resolve,
  register,
  checkAvailability,
} from "./client";
export type { ClientOptions } from "./client";

export {
  DNSOfMoneyError,
  AliasNotFoundError,
  AliasTakenError,
  AuthenticationError,
  RateLimitError,
  CapReachedError,
} from "./exceptions";

export type {
  Entity,
  Endpoint,
  Compliance,
  AgentCard,
  ResolutionResponse,
  RegistrationResponse,
} from "./models";
