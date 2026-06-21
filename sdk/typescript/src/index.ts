export {
  DNSOfMoneyClient,
  resolve,
  register,
  checkAvailability,
  sendPreview,
  send,
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
  Identity,
  AgentCard,
  ResolutionResponse,
  RegistrationResponse,
  SendPreview,
  SendResult,
  SendOptions,
} from "./models";
