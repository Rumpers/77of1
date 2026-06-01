/**
 * FourPillarsSection — MKT-03 four capability pillars with coming-soon badges.
 *
 * Renders four PillarCard components in a responsive grid (1→2→4 columns).
 * Chat and Voice pillars are live; Image and Video pillars show coming-soon badges
 * sourced from i18n keys t.pillars.image_coming_soon / t.pillars.video_coming_soon.
 *
 * PillarCard: relative container, lucide icon, h3 label, p description.
 * Coming-soon badge: absolute top-right, renders only when !live && comingSoonLabel.
 *
 * MKT-11: every grid child carries min-w-0 to prevent flex/grid blowout at 375px.
 * Token isolation: zero fan-page semantic utilities.
 * Font application: inline style={{ fontFamily }} only — not the Tailwind utility.
 */

import { MessageCircle, Mic, Image, Video } from "lucide-react";
import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

interface PillarCardProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  desc: string;
  live: boolean;
  comingSoonLabel?: string;
}

function PillarCard({ icon: Icon, label, desc, live, comingSoonLabel }: PillarCardProps) {
  return (
    <article
      className="relative rounded-[--mkt-radius-md] border border-[--mkt-border]
                 bg-[--mkt-surface-1] p-5 min-w-0
                 transition-colors hover:border-[--mkt-accent]/40"
    >
      {!live && comingSoonLabel && (
        <span
          className="absolute right-3 top-3 rounded-[--mkt-radius-pill]
                     border border-[--mkt-border] bg-[--mkt-surface-2]
                     px-2 py-0.5 text-[0.875rem] text-[--mkt-muted-fg]"
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {comingSoonLabel}
        </span>
      )}
      <Icon className="h-6 w-6 text-[--mkt-muted-fg]" aria-hidden="true" />
      <h3
        className="mt-3 text-[1.5rem] font-semibold leading-[1.2] text-[--mkt-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {label}
      </h3>
      <p
        className="mt-2 text-[0.875rem] leading-[1.6] text-[--mkt-muted-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {desc}
      </p>
    </article>
  );
}

export function FourPillarsSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6">
        <h2
          className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em] mb-10"
          style={{
            fontFamily: "var(--mkt-font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
          }}
        >
          {t.pillars.title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PillarCard
            icon={MessageCircle}
            label={t.pillars.chat_label}
            desc={t.pillars.chat_desc}
            live={true}
          />
          <PillarCard
            icon={Mic}
            label={t.pillars.voice_label}
            desc={t.pillars.voice_desc}
            live={true}
          />
          <PillarCard
            icon={Image}
            label={t.pillars.image_label}
            desc={t.pillars.image_desc}
            live={false}
            comingSoonLabel={t.pillars.image_coming_soon}
          />
          <PillarCard
            icon={Video}
            label={t.pillars.video_label}
            desc={t.pillars.video_desc}
            live={false}
            comingSoonLabel={t.pillars.video_coming_soon}
          />
        </div>
      </div>
    </section>
  );
}
