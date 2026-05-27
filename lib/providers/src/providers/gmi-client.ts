// GMI Inference API base HTTP client — OF-106
// Handles auth, Helicone observability routing, and 5xx retry (max 2 retries).
// 4xx errors are NOT retried — they indicate caller/config errors.
//
// Helicone proxy: when HELICONE_API_KEY is set, requests are routed through
// https://custom.helicone.ai with Helicone-Target-URL pointing at GMI.
// This enables per-creator cost reporting, latency p50/p95, and error rates.

import crypto from "crypto";

const HELICONE_PROXY_BASE = "https://custom.helicone.ai";

export interface GmiClientConfig {
  baseUrl: string;
  apiKey: string;
  heliconeApiKey?: string;
}

export interface GmiRequestOptions {
  path: string;
  body: unknown;
  signal?: AbortSignal;
  // Helicone observability context — attach per-request so dashboards are segmented
  heliconeContext?: {
    creatorId: string;
    jobType: string;
    fanId: string;
  };
}

function hashId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

export class GmiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly heliconeApiKey: string | undefined;

  constructor(config: GmiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.heliconeApiKey = config.heliconeApiKey;
  }

  static fromEnv(): GmiClient {
    const baseUrl = process.env["GMI_API_BASE_URL"];
    const apiKey = process.env["GMI_API_KEY"];
    if (!baseUrl) throw new Error("GMI_API_BASE_URL env var is required");
    if (!apiKey) throw new Error("GMI_API_KEY env var is required");
    return new GmiClient({
      baseUrl,
      apiKey,
      heliconeApiKey: process.env["HELICONE_API_KEY"],
    });
  }

  async post<T>(opts: GmiRequestOptions): Promise<T> {
    return this.requestWithRetry<T>(opts, 0);
  }

  private async requestWithRetry<T>(
    opts: GmiRequestOptions,
    attempt: number
  ): Promise<T> {
    const useHelicone = !!this.heliconeApiKey;

    // Route through Helicone proxy when API key is present.
    // Proxy URL = HELICONE_PROXY_BASE + path; original GMI URL sent as target header.
    const fetchUrl = useHelicone
      ? `${HELICONE_PROXY_BASE}${opts.path}`
      : `${this.baseUrl}${opts.path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (useHelicone) {
      headers["Helicone-Auth"] = `Bearer ${this.heliconeApiKey}`;
      headers["Helicone-Target-URL"] = this.baseUrl;
      if (opts.heliconeContext) {
        const { creatorId, jobType, fanId } = opts.heliconeContext;
        headers["Helicone-Property-Creator-Id"] = creatorId;
        headers["Helicone-Property-Job-Type"] = jobType;
        // fan_id is PII — hash before sending to Helicone
        headers["Helicone-Property-Fan-Id-Hash"] = hashId(fanId);
      }
    }

    const res = await fetch(fetchUrl, {
      method: "POST",
      signal: opts.signal,
      headers,
      body: JSON.stringify(opts.body),
    });

    if (res.ok) {
      return res.json() as Promise<T>;
    }

    // 4xx — caller/config error, do not retry
    if (res.status >= 400 && res.status < 500) {
      const body = await res.text();
      throw new Error(`GMI API ${res.status}: ${body}`);
    }

    // 5xx — transient server error, retry up to 2 times
    if (attempt < 2) {
      const delay = (attempt + 1) * 500;
      await new Promise((r) => setTimeout(r, delay));
      return this.requestWithRetry<T>(opts, attempt + 1);
    }

    const body = await res.text();
    throw new Error(
      `GMI API ${res.status} after ${attempt + 1} attempt(s): ${body}`
    );
  }
}

export function createGmiClient(): GmiClient {
  return GmiClient.fromEnv();
}
