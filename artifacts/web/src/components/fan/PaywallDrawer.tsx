import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getMessages } from "@/lib/i18n";
import { sendFanOtp, verifyFanOtp } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * PaywallDrawer — webview-safe paywall sheet shown after trial exhaustion.
 *
 * Wraps shadcn Drawer (vaul) with subscribe / credits CTAs + email OTP.
 * Brand color paints subscribe and OTP CTAs; credit pill uses brand text + 2px border.
 *
 * Self-contained state machine: email → code → done. On `done`, the parent
 * decides whether to close the drawer (so the fan can resume chatting).
 */

export interface PaywallDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  handle: string;
  brandColor?: string;
  monetizationUrl?: string | null;
  onAuthenticated?: (fanId: string) => void;
}

type OtpStep = "email" | "code" | "done";

export function PaywallDrawer({
  open,
  onOpenChange,
  locale,
  handle,
  brandColor,
  monetizationUrl,
  onAuthenticated,
}: PaywallDrawerProps) {
  const t = getMessages(locale).fan;
  const accent = brandColor ?? "var(--brand, #7c3aed)";

  const [step, setStep] = useState<OtpStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!email.includes("@") || busy) return;
    setBusy(true);
    setError("");
    const res = await sendFanOtp(email);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep("code");
  }

  async function handleVerify() {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError("");
    const { fanId, error: verifyError } = await verifyFanOtp(email, code, handle);
    setBusy(false);
    if (verifyError) {
      setError(t.otp_error_invalid);
      return;
    }
    if (fanId) {
      setStep("done");
      onAuthenticated?.(fanId);
      setTimeout(() => onOpenChange(false), 800);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#161616] border-[#2a2a2a] text-[#f0f0f0] max-w-[480px] mx-auto px-6 pb-10 pt-2 flex flex-col gap-3.5">
        <DrawerTitle className="text-xl font-bold text-[#f0f0f0] mt-2">
          {t.paywall_title}
        </DrawerTitle>

        <p className="m-0 text-[0.875rem] text-[#888]">{t.trial_exhausted}</p>

        {/* Subscribe primary CTA */}
        <a
          href={monetizationUrl ?? "#subscribe"}
          target={monetizationUrl ? "_blank" : undefined}
          rel={monetizationUrl ? "noopener noreferrer" : undefined}
          className="block text-white px-4 py-3.5 rounded-xl no-underline text-center font-bold text-base"
          style={{ background: accent }}
        >
          {t.paywall_subscribe}
        </a>

        {/* Credits secondary CTA */}
        <a
          href="#credits"
          className="block bg-transparent px-4 py-3 rounded-xl no-underline text-center font-semibold text-base border-2"
          style={{ color: accent, borderColor: accent }}
        >
          {t.paywall_credits}
        </a>

        {/* Open in browser escape */}
        <a
          href={typeof window !== "undefined" ? window.location.href : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[0.875rem] text-[#666] no-underline py-1"
        >
          {t.paywall_escape}
        </a>

        {/* OTP block */}
        <div className="border-t border-[#2a2a2a] pt-3.5 mt-1">
          {step === "done" ? (
            <p className="text-center text-[#4ade80] text-[0.9rem] m-0">
              ✓ {t.paywall_signup_cta}
            </p>
          ) : step === "email" ? (
            <>
              <p className="m-0 mb-1.5 text-[0.8125rem] text-[#888] text-center">{t.otp_title}</p>
              <p className="m-0 mb-3 text-[0.75rem] text-[#666] text-center">{t.otp_subtitle}</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={t.otp_email_placeholder}
                autoComplete="email"
                inputMode="email"
                className="w-full box-border bg-[#1a1a1a] border border-[#333] rounded-[10px] text-[#f0f0f0] px-3 py-2.5 text-[0.9375rem] mb-2 outline-none"
              />
              {error && (
                <p className="text-[#f87171] text-[0.75rem] m-0 mb-2 text-center">{error}</p>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={busy || !email.includes("@")}
                className={cn(
                  "w-full text-white border-0 rounded-[10px] py-3 text-[0.9375rem] font-semibold",
                  busy || !email.includes("@") ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                )}
                style={{ background: accent }}
              >
                {busy ? t.otp_sending : t.otp_send_button}
              </button>
            </>
          ) : (
            <>
              <p className="m-0 mb-2.5 text-[0.8125rem] text-[#888] text-center">
                {t.otp_check_email}
              </p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder={t.otp_code_placeholder}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full box-border bg-[#1a1a1a] border border-[#333] rounded-[10px] text-[#f0f0f0] px-3 py-2.5 text-xl tracking-[0.25em] text-center mb-2 outline-none"
              />
              {error && (
                <p className="text-[#f87171] text-[0.75rem] m-0 mb-2 text-center">{error}</p>
              )}
              <button
                type="button"
                onClick={handleVerify}
                disabled={busy || code.length < 6}
                className={cn(
                  "w-full text-white border-0 rounded-[10px] py-3 text-[0.9375rem] font-semibold mb-2",
                  busy || code.length < 6 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                )}
                style={{ background: accent }}
              >
                {busy ? t.otp_verifying : t.otp_verify_button}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                className="bg-transparent border-0 text-[#666] text-[0.8125rem] cursor-pointer py-1 w-full text-center"
              >
                {t.otp_back}
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
