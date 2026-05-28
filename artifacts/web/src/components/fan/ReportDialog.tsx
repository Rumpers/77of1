import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * ReportDialog — shadcn Dialog wrapper for flagging an AI message.
 *
 * Per UI-SPEC Component Inventory state machine:
 *   closed → category-select → submitting → success → closed (1.5s auto)
 *
 * Submit category uses a fixed violet `#7C3AED` (NOT brand color — see Color §
 * "Accent NOT used for: Report submit button").
 */

export type ReportCategory = "off_topic" | "abusive" | "inappropriate" | "fraud";
const REPORT_CATEGORIES: ReportCategory[] = ["off_topic", "abusive", "inappropriate", "fraud"];

export interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string | null;
  locale: string;
  onSubmit: (messageId: string, category: ReportCategory) => Promise<void> | void;
}

export function ReportDialog({
  open,
  onOpenChange,
  messageId,
  locale,
  onSubmit,
}: ReportDialogProps) {
  const t = getMessages(locale).fan;
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCategory(null);
      setSubmitting(false);
      setDone(false);
    }
  }, [open]);

  // Auto-close on done
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => onOpenChange(false), 1500);
    return () => clearTimeout(timer);
  }, [done, onOpenChange]);

  async function handleSubmit() {
    if (!messageId || !category || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(messageId, category);
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-[360px] rounded-2xl text-[#f0f0f0]">
        {done ? (
          <p className="m-0 text-center text-[#4ade80] font-semibold">
            {t.report_success}
          </p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#f0f0f0]">
                {t.report_title}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {REPORT_CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "px-3.5 py-2.5 rounded-[10px] text-left text-[0.9rem] cursor-pointer border-2",
                      selected
                        ? "bg-[#2d1e4e] text-[#c4b5fd] border-[#7C3AED] font-semibold"
                        : "bg-[#111] text-[#aaa] border-[#333]"
                    )}
                  >
                    {t.report_categories[cat]}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 px-2.5 py-2.5 rounded-[10px] border border-[#333] bg-transparent text-[#888] text-[0.9rem] cursor-pointer"
              >
                {t.report_cancel}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!category || submitting}
                className={cn(
                  "flex-1 px-2.5 py-2.5 rounded-[10px] border-0 text-[0.9rem] font-semibold",
                  category
                    ? "bg-[#7C3AED] text-white cursor-pointer"
                    : "bg-[#333] text-[#666] cursor-not-allowed"
                )}
              >
                {t.report_submit}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
