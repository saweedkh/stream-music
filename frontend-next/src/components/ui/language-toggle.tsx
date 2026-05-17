"use client";

import { Languages } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "@/components/providers/locale-provider";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const LOCALE_LABEL_KEYS = {
  en: "lang.en",
  fa: "lang.fa",
} as const satisfies Record<Locale, "lang.en" | "lang.fa">;

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useTranslations();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)} aria-label={t("lang.switch")} disabled>
        <Languages className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 text-muted-foreground hover:text-foreground", className)}
          aria-label={t("lang.switch")}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            className={cn("cursor-pointer", locale === code && "bg-muted/50 font-medium text-foreground")}
            onClick={() => setLocale(code)}
          >
            {t(LOCALE_LABEL_KEYS[code])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
