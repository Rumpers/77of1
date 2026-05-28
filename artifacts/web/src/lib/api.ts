/**
 * Typed API client for the fan SPA.
 *
 * Two surface routes:
 *   GET  /api/twin/:handle/profile   → bootstrap data for the fan page
 *   POST /api/twin/chat              → send a fan message and receive AI reply
 *
 * Both endpoints are same-origin under Replit, so default base URL is empty
 * (relative `/api/...`). VITE_API_BASE_URL can override for split-host dev.
 *
 * All errors throw `ApiError` carrying the HTTP status so the caller can
 * map specific codes to localised strings (423 → error_kyc, 503 →
 * error_paused, network → error_connection).
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface TwinProfile {
  handle: string;
  brand_color: string;
  monetization_url: string | null;
  platform_name: string;
  locale_default: string;
}

export interface TwinChatRequest {
  handle: string;
  message: string;
  locale: string;
}

export interface TwinChatResponse {
  text: string;
  disclosure_footer: string;
  monetization_pivot: boolean;
  conversation_id: string;
}

/** GET /api/twin/:handle/profile — bootstrap CTA data (CHAT-05). */
export async function fetchTwinProfile(handle: string): Promise<TwinProfile> {
  const url = `${BASE_URL}/api/twin/${encodeURIComponent(handle)}/profile`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new ApiError(`Network error: ${(err as Error).message}`, 0);
  }
  if (!res.ok) {
    throw new ApiError(`Failed to load creator profile (${res.status})`, res.status);
  }
  return (await res.json()) as TwinProfile;
}

/** POST /api/twin/chat — send a fan message (CHAT-01). */
export async function sendTwinMessage(req: TwinChatRequest): Promise<TwinChatResponse> {
  const url = `${BASE_URL}/api/twin/chat`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(req),
    });
  } catch (err) {
    throw new ApiError(`Network error: ${(err as Error).message}`, 0);
  }
  if (!res.ok) {
    throw new ApiError(`Twin chat request failed (${res.status})`, res.status);
  }
  return (await res.json()) as TwinChatResponse;
}
