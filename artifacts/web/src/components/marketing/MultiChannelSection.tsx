/**
 * MultiChannelSection — MKT-05
 *
 * Three-channel deployment cards: lala.la, Telegram, Social.
 * Channel cards are centered, icon at 32px in --mkt-accent color, with border hover.
 *
 * Token rule: all styling via --mkt-* tokens (Tailwind arbitrary-value syntax).
 * Font family is always applied via inline style to avoid resolving to the fan-page stack.
 */

import { Globe, Send, Share2 } from "lucide-react";
import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

function ChannelCard({
  icon: Icon,
  label,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 p-6 min-w-0
                 rounded-[--mkt-radius-lg] border border-[--mkt-border]
                 bg-[--mkt-surface-1] text-center
                 transition-colors hover:border-[--mkt-accent]/40"
    >
      <Icon className="h-8 w-8 text-[--mkt-accent]" aria-hidden="true" />
      <h3
        className="text-[1.5rem] font-semibold leading-[1.2] text-[--mkt-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {label}
      </h3>
    </div>
  );
}

export function MultiChannelSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6">
        <h2
          className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
          style={{
            fontFamily: "var(--mkt-font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
          }}
        >
          {t.channels.title}
        </h2>
        <p
          className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {t.channels.subtitle}
        </p>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <ChannelCard icon={Globe} label={t.channels.lala_label} />
          <ChannelCard icon={Send} label={t.channels.telegram_label} />
          <ChannelCard icon={Share2} label={t.channels.social_label} />
        </div>
      </div>
    </section>
  );
}
