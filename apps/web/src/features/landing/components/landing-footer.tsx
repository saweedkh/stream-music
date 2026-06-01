"use client";

import Link from "next/link";
import { useTranslations } from "@/shared/providers/locale-provider";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { LanguageToggle } from "@/shared/ui/language-toggle";
import { LandingBrand } from "./landing-brand";

export function LandingFooter() {
  const { t } = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/[0.06] px-5 py-8 dark:border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-start">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <LandingBrand compact />
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="#features" className="text-[13px] text-muted-foreground hover:text-foreground">
            {t("landing.features.eyebrow")}
          </Link>
          <Link href="#how" className="text-[13px] text-muted-foreground hover:text-foreground">
            {t("landing.how.eyebrow")}
          </Link>
          <Link href="/login" className="text-[13px] text-muted-foreground hover:text-foreground">
            {t("landing.footer.signin")}
          </Link>
          <Link href="/register" className="text-[13px] text-muted-foreground hover:text-foreground">
            {t("landing.footer.register")}
          </Link>
        </nav>

        <div className="flex flex-col items-center gap-3 sm:items-end">
          <div className="flex items-center gap-1">
            <LanguageToggle side="top" align="end" className="h-8 w-8 text-muted-foreground" />
            <ThemeToggle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-[12px] text-muted-foreground">
            © {year} · {t("landing.footer.copy")}
          </p>
        </div>
      </div>
    </footer>
  );
}
