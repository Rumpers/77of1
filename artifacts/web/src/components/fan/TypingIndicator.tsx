/**
 * TypingIndicator — animated 3-dot "twin is typing" cue.
 *
 * Renders inside an AI bubble while we wait for the LLM response. Uses
 * Tailwind `animate-bounce` with staggered delays. Accessible via
 * `role="status"` + `aria-label`.
 */

export interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({ label = "Twin is typing" }: TypingIndicatorProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="inline-flex items-center gap-1 px-1 py-2"
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-[#666] animate-bounce [animation-delay:-0.3s]" />
      <span className="block h-1.5 w-1.5 rounded-full bg-[#666] animate-bounce [animation-delay:-0.15s]" />
      <span className="block h-1.5 w-1.5 rounded-full bg-[#666] animate-bounce" />
    </div>
  );
}
