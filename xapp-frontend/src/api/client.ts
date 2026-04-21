// JWT-aware fetch wrapper.
// Every component that talks to the backend goes through useApiClient().
// Non-negotiable #4 per xaman-xapp-frontend skill — components never fetch
// the backend directly.

import { useXaman } from "../xaman/useXaman";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = "ApiError";
  }
}

/**
 * Hook returning an authenticated request function.
 * Injects `Authorization: Bearer <jwt>` from the active Xaman session.
 * Throws if called before the session has booted.
 */
export function useApiClient() {
  const { session } = useXaman();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!session) {
      throw new Error(
        "No Xaman session yet — wait for useXaman().loading to finish before calling the API.",
      );
    }
    if (!API_BASE) {
      throw new Error("VITE_API_BASE_URL is not set");
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.jwt}`,
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // Body may not be JSON — swallow and let caller read ApiError.body === null.
      }
      throw new ApiError(res.status, body);
    }

    // 204 No Content → nothing to parse.
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
  }

  return { request };
}
