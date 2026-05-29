import { cn } from "@/lib/utils";

/**
 * MessageBubble — single chat message bubble.
 *
 * Roles:
 * - "fan"    → outgoing (right-aligned, brand-color fill, white text, rounded-tl/tr/bl)
 * - "ai"     → incoming (left-aligned, neutral-900 fill, light text, rounded-tl/tr/br)
 * - "crisis" → SB-243 helpline injection (left amber border, neutral-900 fill, amber text)
 * - "system" → KYC/paused/connection error (muted text, centered, no fill)
 *
 * Per PATTERNS E1: bubble shape via rounded corners + role-conditional bg.
 * Brand color is the ONLY remaining inline style (CSS var on fan bubble background).
 */

export type BubbleRole = "fan" | "ai" | "crisis" | "system";

export interface MessageBubbleProps {
  role: BubbleRole;
  text: string;
  pending?: boolean;
  brandColor?: string;
  children?: React.ReactNode; // for trailing widgets (disclosure footer, report flag)
}

export function MessageBubble({
  role,
  text,
  pending = false,
  brandColor,
  children,
}: MessageBubbleProps) {
  const isFan = role === "fan";
  const isCrisis = role === "crisis";
  const isSystem = role === "system";

  if (isSystem) {
    return (
      <div className="text-center text-[0.8125rem] text-[#888] py-2 px-3" role="status">
        {text}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isFan ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] px-3.5 py-2.5 text-[0.9375rem] leading-snug",
          isFan && "rounded-[16px_16px_4px_16px] text-white",
          !isFan && !isCrisis && "rounded-[16px_16px_16px_4px] bg-[#2a2a2a] text-[#e8e8e8]",
          isCrisis && "rounded-[16px_16px_16px_4px] bg-[#1a1a1a] text-[#fbbf24] border-l-4 border-[#f59e0b]",
          pending && "opacity-60"
        )}
        style={isFan && brandColor ? { background: brandColor } : undefined}
      >
        {text}
      </div>
      {children}
    </div>
  );
}
