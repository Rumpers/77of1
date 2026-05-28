import { useLocation } from "wouter";
import { Check, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * LocaleSwitcher — top-right globe dropdown to switch fan-page locale.
 *
 * Per UI-SPEC Locale switcher §:
 * - 44×44px hit area (h-11 w-11)
 * - Absolute top-3 right-3, overlay above hero cover
 * - DropdownMenu with EN / 日本語 / 繁中 entries
 * - Click → setLocation(`/${locale}/${handle}`) via wouter
 * - Active locale shows Check mark
 *
 * Spoofing mitigation T-02-04-03: the destination locale is always one of
 * the three known strings from the LOCALES allow-list — never user input.
 */

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  "zh-TW": "繁中",
};

export interface LocaleSwitcherProps {
  currentLocale: string;
  handle: string;
}

export function LocaleSwitcher({ currentLocale, handle }: LocaleSwitcherProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="absolute top-3 right-3 z-30">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Switch language"
            className="h-11 w-11 bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
          >
            <Globe className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[8rem]">
          {LOCALES.map((loc) => {
            const isActive = loc === currentLocale;
            return (
              <DropdownMenuItem
                key={loc}
                onSelect={() => setLocation(`/${loc}/${handle}`)}
                className={cn("flex items-center justify-between gap-2 cursor-pointer", isActive && "font-semibold")}
              >
                <span>{LOCALE_LABELS[loc]}</span>
                {isActive && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
