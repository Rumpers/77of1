// Resend email provider — HID-001
// Swap to another provider by setting EMAIL_PROVIDER=<name> and swapping
// this file's import in getEmailProvider(). Interface is stable.
//
// Bounce/complaint suppression: managed via Resend's Suppressions API.
// Resend automatically suppresses bounced/complained addresses; this adapter
// also exposes manual suppressAddress() for unsubscribe flows.
//
// Config (env):
//   RESEND_API_KEY   — required
//   EMAIL_FROM       — sender address, default "no-reply@7of1.com"
//   EMAIL_REPLY_TO   — optional global reply-to

import type {
  IEmailProvider,
  EmailInput,
  EmailResult,
} from "./interfaces.js";
import { ProviderError, ProviderTransientError } from "./interfaces.js";
import { renderTemplate } from "./email-templates.js";

function getApiKey(): string {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return key;
}

const DEFAULT_FROM = "7of1 <no-reply@7of1.com>";

// ── Resend REST API types (minimal surface — avoids SDK dependency) ───────────

interface ResendSendBody {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
  tags?: Array<{ name: string; value: string }>;
}

interface ResendSendResponse {
  id: string;
}

interface ResendErrorResponse {
  name: string;
  message: string;
  statusCode: number;
}

async function resendRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.ok) {
    // DELETE 200 may return empty body
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  const errText = await res.text().catch(() => "");
  let errBody: Partial<ResendErrorResponse> = {};
  try {
    errBody = JSON.parse(errText);
  } catch {
    // ignore parse failure
  }

  const msg = errBody.message ?? errText;
  // 4xx → non-retryable; 5xx → retryable
  if (res.status >= 500) {
    throw new ProviderTransientError(
      `Resend ${method} ${path} ${res.status}: ${msg}`,
      res.status,
      "resend"
    );
  }
  throw new ProviderError(
    `Resend ${method} ${path} ${res.status}: ${msg}`,
    res.status,
    "resend"
  );
}

// ── ResendEmailProvider ────────────────────────────────────────────────────────

export class ResendEmailProvider implements IEmailProvider {
  private readonly from: string;
  private readonly globalReplyTo: string | undefined;

  constructor(opts?: { from?: string; replyTo?: string }) {
    this.from =
      opts?.from ?? process.env["EMAIL_FROM"] ?? DEFAULT_FROM;
    this.globalReplyTo =
      opts?.replyTo ?? process.env["EMAIL_REPLY_TO"];
  }

  async sendEmail(input: EmailInput): Promise<EmailResult> {
    // Pre-flight: check suppression list
    if (await this.isSuppressed(input.to)) {
      return { messageId: "", success: true, suppressed: true };
    }

    const rendered = renderTemplate(input.template, input.locale, input.data);

    const body: ResendSendBody = {
      from: this.from,
      to: [input.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };

    const replyTo = input.replyTo ?? this.globalReplyTo;
    if (replyTo) body.reply_to = replyTo;

    if (input.tags) {
      body.tags = Object.entries(input.tags).map(([name, value]) => ({
        name,
        value,
      }));
    }

    const result = await resendRequest<ResendSendResponse>(
      "/emails",
      "POST",
      body
    );

    return { messageId: result.id, success: true };
  }

  async suppressAddress(
    email: string,
    _reason: "bounce" | "complaint" | "unsubscribe"
  ): Promise<void> {
    // Resend suppressions API: POST /suppressions
    await resendRequest<unknown>("/suppressions", "POST", { email });
  }

  async isSuppressed(email: string): Promise<boolean> {
    try {
      // GET /suppressions?email=<email>
      const encodedEmail = encodeURIComponent(email);
      const data = await resendRequest<{ data: Array<{ email: string }> }>(
        `/suppressions?email=${encodedEmail}`,
        "GET"
      );
      return Array.isArray(data?.data) && data.data.length > 0;
    } catch {
      // If suppression check fails, allow send (fail open — better to send than block).
      return false;
    }
  }
}

// ── Singleton factory ──────────────────────────────────────────────────────────

let _emailProvider: IEmailProvider | undefined;

export function getEmailProvider(): IEmailProvider {
  if (_emailProvider) return _emailProvider;

  const name = process.env["EMAIL_PROVIDER"] ?? "resend";
  switch (name) {
    case "resend":
      _emailProvider = new ResendEmailProvider();
      break;
    case "mock":
      // Import MockEmailProvider at call time to avoid circular deps in test env.
      throw new Error(
        "Use MockEmailProvider directly in tests rather than EMAIL_PROVIDER=mock"
      );
    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER="${name}". Supported values: resend`
      );
  }

  return _emailProvider;
}

/** Reset cached singleton — useful in tests. */
export function resetEmailProvider(): void {
  _emailProvider = undefined;
}
