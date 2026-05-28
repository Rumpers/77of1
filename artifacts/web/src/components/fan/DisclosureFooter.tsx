/**
 * DisclosureFooter — appears under every AI message bubble (SB-243 / COMPLY-01).
 *
 * Server is the source of truth (D-02-12): when the `/api/twin/chat` response
 * provides `disclosure_footer`, we render that verbatim. Otherwise we fall
 * back to the locale default ("AI twin · @{handle}_ai" pattern).
 *
 * Renders inline with optional trailing children (e.g. report flag button).
 */

type LocaleKey = "en" | "ja" | "zh-TW";

function defaultFooter(locale: string, handle: string): string {
  const map: Record<LocaleKey, string> = {
    en: `AI twin · @${handle}_ai`,
    ja: `AIツイン · @${handle}_ai`,
    "zh-TW": `AI分身 · @${handle}_ai`,
  };
  return map[(locale as LocaleKey)] ?? map.en;
}

export interface DisclosureFooterProps {
  handle: string;
  locale: string;
  footerText?: string | null;
  children?: React.ReactNode;
}

export function DisclosureFooter({ handle, locale, footerText, children }: DisclosureFooterProps) {
  return (
    <div className="flex items-center gap-2 mt-1 pl-1">
      <span className="text-[0.6875rem] text-[#555]">
        {footerText && footerText.length > 0 ? footerText : defaultFooter(locale, handle)}
      </span>
      {children}
    </div>
  );
}
