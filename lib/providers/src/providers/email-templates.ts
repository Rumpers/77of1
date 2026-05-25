// Email templates — HID-001
// All templates are stored in version control and previewable in dev.
// Add a new template: (1) add type to EmailTemplate in interfaces.ts,
// (2) add subject + html entries here for each locale.
//
// Variable substitution: use {{key}} placeholders in subject and html strings.
// renderTemplate() replaces all occurrences with values from EmailInput.data.

import type { EmailLocale, EmailTemplate } from "./interfaces.js";

interface TemplateBody {
  subject: string;
  html: string;
  /** Plain-text fallback (required for deliverability). */
  text: string;
}

type LocaleMap = Partial<Record<EmailLocale, TemplateBody>> &
  Required<Pick<Record<EmailLocale, TemplateBody>, "en">>;

const TEMPLATES: Record<EmailTemplate, LocaleMap> = {
  // ── magic_link ─────────────────────────────────────────────────────────────
  magic_link: {
    en: {
      subject: "Your sign-in link for 7of1",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Sign in to 7of1</h2>
<p>Click the link below to sign in. It expires in <strong>{{expiresInMinutes}} minutes</strong>.</p>
<p><a href="{{magicLink}}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Sign in</a></p>
<p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#999;font-size:11px">7of1 · <a href="{{unsubscribeLink}}" style="color:#999">Unsubscribe</a></p>
</body></html>`,
      text: `Sign in to 7of1\n\nClick here to sign in: {{magicLink}}\n\nExpires in {{expiresInMinutes}} minutes.\n\nIf you didn't request this, ignore this email.`,
    },
    ja: {
      subject: "7of1 サインインリンク",
      html: `
<!DOCTYPE html><html lang="ja"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>7of1 へのサインイン</h2>
<p>以下のリンクをクリックしてサインインしてください。有効期限は<strong>{{expiresInMinutes}}分</strong>です。</p>
<p><a href="{{magicLink}}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">サインイン</a></p>
<p style="color:#666;font-size:13px">このメールに心当たりがない場合は、無視してください。</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#999;font-size:11px">7of1 · <a href="{{unsubscribeLink}}" style="color:#999">配信停止</a></p>
</body></html>`,
      text: `7of1 へのサインイン\n\nこちらからサインインしてください: {{magicLink}}\n\n有効期限: {{expiresInMinutes}}分\n\n心当たりがない場合は無視してください。`,
    },
    "zh-TW": {
      subject: "您的 7of1 登入連結",
      html: `
<!DOCTYPE html><html lang="zh-TW"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>登入 7of1</h2>
<p>點擊以下連結登入。有效期限為 <strong>{{expiresInMinutes}} 分鐘</strong>。</p>
<p><a href="{{magicLink}}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">登入</a></p>
<p style="color:#666;font-size:13px">如果您未要求此操作，請忽略此電子郵件。</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#999;font-size:11px">7of1 · <a href="{{unsubscribeLink}}" style="color:#999">取消訂閱</a></p>
</body></html>`,
      text: `登入 7of1\n\n點擊此處登入: {{magicLink}}\n\n有效期限 {{expiresInMinutes}} 分鐘。\n\n若非本人操作，請忽略此信件。`,
    },
  },

  // ── otp ────────────────────────────────────────────────────────────────────
  // Full locale copy implemented in HID-003-C (OF-143).
  otp: {
    en: {
      subject: "Your 7of1 verification code",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Verification code</h2>
<p>Your code: <strong style="font-size:2em;letter-spacing:4px">{{otp}}</strong></p>
<p style="color:#666;font-size:13px">Expires in {{expiresInMinutes}} minutes. Do not share this code.</p>
</body></html>`,
      text: `Your 7of1 verification code: {{otp}}\n\nExpires in {{expiresInMinutes}} minutes. Do not share this code.`,
    },
  },

  // ── payment_receipt ─────────────────────────────────────────────────────────
  payment_receipt: {
    en: {
      subject: "Payment receipt — 7of1",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Payment receipt</h2>
<p>Thank you for your payment of <strong>{{amount}}</strong> to <strong>{{creatorName}}</strong>.</p>
<p>Date: {{date}</p>
<p>Reference: <code>{{reference}}</code></p>
</body></html>`,
      text: `Payment receipt\n\nAmount: {{amount}}\nCreator: {{creatorName}}\nDate: {{date}}\nRef: {{reference}}`,
    },
  },

  // ── refund_confirmation ─────────────────────────────────────────────────────
  // Full templates implemented in HID-011-E (OF-194).
  refund_confirmation: {
    en: {
      subject: "Refund update — 7of1",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Refund update</h2>
<p>Your refund request (ref: <code>{{refundId}}</code>) has been updated.</p>
<p>Status: <strong>{{status}}</strong></p>
<p>{{message}}</p>
</body></html>`,
      text: `Refund update\n\nRef: {{refundId}}\nStatus: {{status}}\n\n{{message}}`,
    },
  },

  // ── dunning templates ───────────────────────────────────────────────────────
  // Full templates + pay-now links implemented in OF-169.
  dunning_soft_fail: {
    en: {
      subject: "Payment issue — action needed",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Payment issue</h2>
<p>We couldn't process your payment for your subscription to <strong>{{creatorName}}</strong>.</p>
<p>Please update your payment method to continue your subscription.</p>
<p><a href="{{payNowLink}}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Update payment</a></p>
</body></html>`,
      text: `Payment issue\n\nWe couldn't process your payment for {{creatorName}}.\n\nUpdate payment: {{payNowLink}}`,
    },
  },
  dunning_paused: {
    en: {
      subject: "Your subscription is paused",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Subscription paused</h2>
<p>Your subscription to <strong>{{creatorName}}</strong> has been paused due to a payment failure.</p>
<p><a href="{{payNowLink}}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Resume subscription</a></p>
</body></html>`,
      text: `Your subscription to {{creatorName}} is paused.\n\nResume here: {{payNowLink}}`,
    },
  },
  dunning_reminder_2: {
    en: {
      subject: "Reminder: subscription still paused",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Subscription still paused</h2>
<p>This is a reminder that your subscription to <strong>{{creatorName}}</strong> remains paused.</p>
<p><a href="{{payNowLink}}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Reactivate now</a></p>
</body></html>`,
      text: `Reminder: your subscription to {{creatorName}} is still paused.\n\nReactivate: {{payNowLink}}`,
    },
  },
  dunning_reminder_3: {
    en: {
      subject: "Final reminder — subscription ending soon",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Final reminder</h2>
<p>Your subscription to <strong>{{creatorName}}</strong> will be cancelled unless you update your payment.</p>
<p><a href="{{payNowLink}}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Pay now to keep access</a></p>
</body></html>`,
      text: `Final reminder: your subscription to {{creatorName}} will be cancelled soon.\n\nPay now: {{payNowLink}}`,
    },
  },
  dunning_cancelled: {
    en: {
      subject: "Your subscription has been cancelled",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Subscription cancelled</h2>
<p>Your subscription to <strong>{{creatorName}}</strong> has been cancelled due to non-payment.</p>
<p>You can resubscribe at any time at <a href="{{resubscribeLink}}">7of1</a>.</p>
</body></html>`,
      text: `Your subscription to {{creatorName}} has been cancelled.\n\nResubscribe: {{resubscribeLink}}`,
    },
  },

  // ── consent_receipt ─────────────────────────────────────────────────────────
  consent_receipt: {
    en: {
      subject: "Consent record — 7of1",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Consent on file</h2>
<p>This email confirms your consent to AI-generated interactions with <strong>{{creatorName}}</strong>.</p>
<p>Version: {{consentVersion}} · Date: {{date}}</p>
<p>You can review or withdraw consent at any time in your account settings.</p>
</body></html>`,
      text: `Consent record\n\nCreator: {{creatorName}}\nVersion: {{consentVersion}}\nDate: {{date}}\n\nTo withdraw consent, visit your account settings.`,
    },
  },

  // ── account_deletion_request ─────────────────────────────────────────────────
  account_deletion_request: {
    en: {
      subject: "Account deletion request received — 7of1",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Deletion request received</h2>
<p>We received a request to delete your 7of1 account. Your account will be deleted within <strong>7 days</strong>.</p>
<p>If you change your mind, you can cancel this request within 7 days by signing in to your account.</p>
<p style="color:#666;font-size:13px">If you did not request this, contact us immediately.</p>
</body></html>`,
      text: `Account deletion request\n\nWe received a request to delete your account. It will be deleted within 7 days.\n\nTo cancel, sign in within 7 days.`,
    },
  },

  // ── account_deletion_complete ─────────────────────────────────────────────────
  account_deletion_complete: {
    en: {
      subject: "Your account has been deleted — 7of1",
      html: `
<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2>Account deleted</h2>
<p>Your 7of1 account and associated data have been permanently deleted.</p>
<p>Reference: <code>{{deletionReference}}</code></p>
<p style="color:#666;font-size:13px">This action cannot be undone. Thank you for using 7of1.</p>
</body></html>`,
      text: `Your 7of1 account has been permanently deleted.\n\nRef: {{deletionReference}}\n\nThank you for using 7of1.`,
    },
  },
};

/** Replace all {{key}} placeholders with values from data. */
function substitute(
  template: string,
  data: Record<string, string | number | boolean>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = data[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

/** Resolve locale with fallback: requested → "en". */
function resolveLocale(
  localeMap: LocaleMap,
  requested: EmailLocale | undefined
): TemplateBody {
  if (requested && requested !== "en" && localeMap[requested]) {
    return localeMap[requested]!;
  }
  return localeMap.en;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate(
  template: EmailTemplate,
  locale: EmailLocale | undefined,
  data: Record<string, string | number | boolean>
): RenderedEmail {
  const localeMap = TEMPLATES[template];
  if (!localeMap) {
    throw new Error(`Unknown email template: ${template}`);
  }
  const body = resolveLocale(localeMap, locale);
  return {
    subject: substitute(body.subject, data),
    html: substitute(body.html, data),
    text: substitute(body.text, data),
  };
}

/** List all templates with their available locales — for dev preview tooling. */
export function listTemplates(): Array<{
  template: EmailTemplate;
  locales: EmailLocale[];
}> {
  return (Object.keys(TEMPLATES) as EmailTemplate[]).map((t) => ({
    template: t,
    locales: Object.keys(TEMPLATES[t]) as EmailLocale[],
  }));
}
