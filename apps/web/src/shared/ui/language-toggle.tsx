"use client";

import { Check, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useTranslations } from "@/shared/providers/locale-provider";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const LOCALE_META: Record<Locale, { labelKey: "lang.en" | "lang.fa"; native: string }> = {
  en: { labelKey: "lang.en", native: "English" },
  fa: { labelKey: "lang.fa", native: "فارسی" },
};

export function LanguageToggle({
  className,
  side = "bottom",
  align = "end",
}: {
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
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
      <DropdownMenuContent side={side} align={align} sideOffset={8} className="min-w-[10rem]">
        <DropdownMenuLabel>{t("lang.switch")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code) => {
          const active = locale === code;
          return (
            <DropdownMenuItem
              key={code}
              className={cn(
                "cursor-pointer gap-2",
                active && "bg-brand/[0.08] font-medium text-brand",
              )}
              onClick={() => setLocale(code)}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
              <span className="flex flex-1 items-center justify-between gap-3">
                <span>{t(LOCALE_META[code].labelKey)}</span>
                <span className="text-xs text-muted-foreground">{LOCALE_META[code].native}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
