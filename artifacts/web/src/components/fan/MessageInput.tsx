import { useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * MessageInput — textarea + send button row at the bottom of the chat.
 *
 * Per UI-SPEC Interaction Contract step 1:
 * - Enter (no shift) → submits
 * - Shift+Enter → newline
 *
 * Send button background = brand color (CSS var) when enabled; greys-out when disabled.
 * Uses safe-area-inset-bottom padding so iOS home indicator does not overlap.
 */

export interface MessageInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder: string;
  sendLabel: string;
  brandColor?: string;
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder,
  sendLabel,
  brandColor,
}: MessageInputProps) {
  const canSend = !disabled && value.trim().length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) onSubmit();
      }
    },
    [canSend, onSubmit]
  );

  return (
    <div
      className="flex items-end gap-2 px-4 py-3 border-t border-[#222] bg-[#0f0f0f] shrink-0"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label={placeholder}
        className={cn(
          "flex-1 bg-[#1a1a1a] border border-[#333] rounded-[10px] text-[#f0f0f0]",
          "px-3 py-2.5 text-[0.9375rem] leading-snug resize-none outline-none",
          "max-h-24 overflow-y-auto"
        )}
      />
      <button
        type="button"
        onClick={() => canSend && onSubmit()}
        disabled={!canSend}
        aria-label={sendLabel}
        className={cn(
          "shrink-0 text-white border-none rounded-[10px] px-4 py-2.5",
          "text-[0.9375rem] font-semibold",
          !canSend && "opacity-50 cursor-not-allowed",
          canSend && "cursor-pointer"
        )}
        style={{ background: brandColor ?? "var(--brand, #7c3aed)" }}
      >
        {sendLabel}
      </button>
    </div>
  );
}
