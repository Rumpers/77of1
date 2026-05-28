import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE, getMessages, isValidLocale } from "@/lib/i18n";
import { ApiError, fetchTwinProfile, sendTwinMessage } from "@/lib/api";
import { MessageBubble, type BubbleRole } from "@/components/fan/MessageBubble";
import { MessageInput } from "@/components/fan/MessageInput";
import { DisclosureBanner } from "@/components/fan/DisclosureBanner";
import { DisclosureFooter } from "@/components/fan/DisclosureFooter";
import { TypingIndicator } from "@/components/fan/TypingIndicator";
import { LocaleSwitcher } from "@/components/fan/LocaleSwitcher";
import { ReportDialog, type ReportCategory } from "@/components/fan/ReportDialog";
import { PaywallDrawer } from "@/components/fan/PaywallDrawer";

const MAX_TRIAL = 3;
const CJK_FONT =
  '"Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", "Microsoft JhengHei", system-ui, sans-serif';

const trialKey = (h: string) => `7of1_trial_${h}`;
function readTrial(handle: string): number {
  try { return parseInt(sessionStorage.getItem(trialKey(handle)) ?? "0", 10) || 0; } catch { return 0; }
}
function writeTrial(handle: string, n: number): void {
  try { sessionStorage.setItem(trialKey(handle), String(n)); } catch { /* private mode */ }
}
function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

type ChatMessage = {
  id: string;
  role: BubbleRole;
  text: string;
  pending?: boolean;
  reported?: boolean;
  footerText?: string;
};

export default function FanPage() {
  const params = useParams<{ locale: string; handle: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const handle = params.handle ?? "";
  const t = getMessages(locale).fan;

  // Creator profile from API (CHAT-05 — no more fixture lookup)
  const { data: profile } = useQuery({
    queryKey: ["twin-profile", handle],
    queryFn: () => fetchTwinProfile(handle),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const brandColor = profile?.brand_color ?? "#7c3aed";

  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.id = "creator-css-vars";
    style.textContent = `:root{--brand:${brandColor};}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [brandColor]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [trialCount, setTrialCountState] = useState(() => readTrial(handle));
  const [showPaywall, setShowPaywall] = useState(false);
  const [fanAuthenticated, setFanAuthenticated] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const trialExhausted = !fanAuthenticated && trialCount >= MAX_TRIAL;
  const remaining = MAX_TRIAL - trialCount;
  const fontFamily = locale === "en" ? "system-ui, -apple-system, sans-serif" : CJK_FONT;
  const coverUrl = `https://placehold.co/800x300/${brandColor.replace("#", "")}/ffffff?text=${encodeURIComponent(handle)}`;

  function openReport(messageId: string) {
    setReportTargetId(messageId);
    setReportOpen(true);
  }

  async function submitReport(messageId: string, category: ReportCategory) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId, category, message_text: msg.text, handle, locale }),
    }).catch(() => {/* fire-and-forget */});
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reported: true } : m)));
  }

  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || sending) return;
    if (trialCount >= MAX_TRIAL && !fanAuthenticated) { setShowPaywall(true); return; }

    const fanMsg: ChatMessage = { id: `fan-${Date.now()}`, role: "fan", text };
    const pendingMsg: ChatMessage = { id: `ai-pending-${Date.now()}`, role: "ai", text: "", pending: true };
    setMessages((prev) => [...prev, fanMsg, pendingMsg]);
    setInputValue("");
    setSending(true);

    try {
      const data = await sendTwinMessage({ handle, message: text, locale });
      const newCount = trialCount + 1;
      writeTrial(handle, newCount);
      setTrialCountState(newCount);
      const aiMsg: ChatMessage = { id: `ai-${Date.now()}`, role: "ai", text: data.text, footerText: data.disclosure_footer };
      setMessages((prev) => prev.filter((m) => !m.pending).concat(aiMsg));
      if (newCount >= MAX_TRIAL && !fanAuthenticated) setTimeout(() => setShowPaywall(true), 600);
    } catch (err) {
      let errorText = t.error_connection;
      if (err instanceof ApiError) {
        if (err.status === 423) errorText = t.error_kyc;
        else if (err.status === 503) errorText = interpolate(t.error_paused, { handle });
      }
      setMessages((prev) => prev.filter((m) => !m.pending).concat({ id: `ai-err-${Date.now()}`, role: "system", text: errorText }));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex flex-col min-h-[100dvh] bg-[#0f0f0f] text-[#f0f0f0] relative max-w-[480px]" style={{ fontFamily }}>
      <DisclosureBanner locale={locale} />

      <div className="shrink-0 relative">
        <LocaleSwitcher currentLocale={locale} handle={handle} />
        <img src={coverUrl} alt={handle} loading="eager" className="w-full block max-h-[200px] object-cover" />
        <div className="px-5 pt-4 pb-3">
          <h1 className="m-0 mb-1 text-[1.375rem] font-semibold" style={{ color: brandColor }}>@{handle}</h1>
          <p className="m-0 text-[#aaa] text-[0.875rem]">Chat with @{handle}'s AI twin — available 24/7</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
        {messages.length === 0 && (
          <p className="text-center text-[#555] text-[0.8125rem] mt-8">{interpolate(t.empty_state, { handle })}</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} text={msg.text} pending={msg.pending} brandColor={brandColor}>
            {msg.pending && msg.role === "ai" && <TypingIndicator label={t.loading} />}
            {msg.role === "ai" && !msg.pending && (
              <DisclosureFooter handle={handle} locale={locale} footerText={msg.footerText}>
                {!msg.reported ? (
                  <button type="button" onClick={() => openReport(msg.id)} aria-label={t.report_button} className="bg-transparent border-0 cursor-pointer text-[0.6875rem] text-[#444] leading-none opacity-60 px-0.5">⚑</button>
                ) : (
                  <span className="text-[0.6875rem] text-[#555] opacity-50">✓</span>
                )}
              </DisclosureFooter>
            )}
          </MessageBubble>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!trialExhausted && messages.length > 0 && (
        <div className="text-center text-xs text-[#666] py-1">{interpolate(t.trial_remaining, { n: remaining })}</div>
      )}
      {trialExhausted && !showPaywall && (
        <button type="button" onClick={() => setShowPaywall(true)} className="text-center text-xs text-[#888] py-1 cursor-pointer bg-transparent border-0">
          {t.trial_exhausted} · {t.paywall_title}
        </button>
      )}

      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={sendMessage}
        disabled={sending || trialExhausted}
        placeholder={interpolate(t.chat_placeholder, { handle })}
        sendLabel={t.send}
        brandColor={brandColor}
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} messageId={reportTargetId} locale={locale} onSubmit={submitReport} />

      <PaywallDrawer
        open={showPaywall}
        onOpenChange={setShowPaywall}
        locale={locale}
        handle={handle}
        brandColor={brandColor}
        monetizationUrl={profile?.monetization_url ?? null}
        onAuthenticated={() => setFanAuthenticated(true)}
      />

      <div className="text-center py-3 border-t border-[#1e1e1e] mt-2">
        <a href={`/${locale}/account/data-request`} className="text-[0.6875rem] text-[#444] no-underline">
          {locale === "ja" ? "データに関する権利" : locale === "zh-TW" ? "您的資料權利" : "Your data rights"}
        </a>
      </div>
    </main>
  );
}
