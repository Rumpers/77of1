import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";

/**
 * DisclosureBanner — top-of-page AI disclosure (SB-243 / COMPLY-01).
 *
 * Auto-dismisses after 3 seconds OR on click. Renders nothing once dismissed.
 * `role="status" aria-live="polite"` per Accessibility Contract — announced to
 * screen readers without stealing focus.
 */

export interface DisclosureBannerProps {
  locale: string;
  autoDismissMs?: number;
}

export function DisclosureBanner({ locale, autoDismissMs = 3000 }: DisclosureBannerProps) {
  const [visible, setVisible] = useState(true);
  const t = getMessages(locale).fan;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, autoDismissMs]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setVisible(false)}
      className="bg-[#1a1a2e] text-[#e0e0ff] text-[0.8125rem] text-center px-4 py-2 cursor-pointer select-none border-b border-[#2a2a4a] z-20"
    >
      {t.disclosure_banner}
    </div>
  );
}
