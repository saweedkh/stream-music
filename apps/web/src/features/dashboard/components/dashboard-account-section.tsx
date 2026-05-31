"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronDown, Languages, LogOut, Moon, Sun } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Separator } from "@/shared/ui/separator";
import { UsernameWithBadges } from "@/shared/ui/user-verified-badge";
import { logoutUser, type AuthUser } from "@/lib/api";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const LOCALE_LABEL_KEYS = {
  en: "lang.en",
  fa: "lang.fa",
} as const satisfies Record<Locale, "lang.en" | "lang.fa">;

type DashboardAccountSectionProps = {
  user: AuthUser | null;
  onAction?: () => void;
  preferencesInMenu?: boolean;
};

export function DashboardAccountSection({ user, onAction, preferencesInMenu = false }: DashboardAccountSectionProps) {
  const { t, locale, setLocale } = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!user) {
    return (
      <Link href="/login" onClick={onAction}>
        <Button variant="secondary" size="sm" className="w-full">
          {t("nav.login")}
        </Button>
      </Link>
    );
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      onAction?.();
      window.location.href = "/login";
    }
  }

  if (!preferencesInMenu) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <UserAvatar
            username={user.username}
            avatarUrl={user.avatar_url}
            className="h-9 w-9 border border-border"
            fallbackClassName="bg-muted text-xs font-medium text-foreground"
          />
          <div className="min-w-0">
            <UsernameWithBadges username={user.username} flags={user} usernameClassName="text-sm font-medium text-foreground" />
            <p className="text-xs text-muted-foreground">{t("nav.account")}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void handleLogout()}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </div>
    );
  }

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-start",
            "transition-colors hover:bg-muted/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
            "data-[state=open]:bg-muted/40",
          )}
        >
          <UserAvatar
            username={user.username}
            avatarUrl={user.avatar_url}
            className="h-10 w-10 shrink-0 ring-2 ring-brand/15"
            fallbackClassName="bg-gradient-to-br from-brand/25 to-brand/5 text-sm font-semibold"
          />
          <div className="min-w-0 flex-1 text-start">
            <UsernameWithBadges username={user.username} flags={user} usernameClassName="text-sm font-semibold text-foreground" />
            <p className="text-[11px] text-muted-foreground">{t("dashboard.preferences")}</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground transition-colors group-hover:bg-muted/55 group-data-[state=open]:bg-brand/10 group-data-[state=open]:text-brand">
            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[15.5rem] overflow-hidden p-0"
      >
        <div className="border-b border-border/60 bg-muted/15 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("dashboard.preferences")}
          </p>
        </div>

        <div className="space-y-2 p-2">
          <DropdownMenuItem
            className="cursor-pointer gap-3 rounded-lg px-2.5 py-2.5 focus:bg-muted/50"
            disabled={!mounted}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isDark ? "bg-amber-500/15 text-amber-500" : "bg-indigo-500/15 text-indigo-400",
              )}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
            <span className="text-sm font-medium text-foreground">
              {isDark ? t("theme.toLight") : t("theme.toDark")}
            </span>
          </DropdownMenuItem>

          <div className="rounded-lg border border-border/50 bg-card/30 p-2">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Languages className="h-3 w-3" aria-hidden />
              {t("lang.switch")}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {LOCALES.map((code) => {
                const active = locale === code;
                return (
                  <button
                    key={code}
                    type="button"
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-all",
                      active
                        ? "border-brand/40 bg-brand/12 text-brand shadow-sm shadow-brand/10"
                        : "border-transparent bg-muted/25 text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                    )}
                    onClick={() => {
                      setLocale(code);
                      onAction?.();
                    }}
                  >
                    {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    {t(LOCALE_LABEL_KEYS[code])}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Separator className="bg-border/60" />

        <div className="p-2">
          <DropdownMenuItem
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => void handleLogout()}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">{t("nav.logout")}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
