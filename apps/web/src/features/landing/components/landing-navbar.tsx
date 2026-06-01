"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { LanguageToggle } from "@/shared/ui/language-toggle";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";
import { LandingBrand } from "./landing-brand";

export function LandingNavbar() {
  const { t } = useTranslations();
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scrollEl = headerRef.current?.parentElement;
    if (!scrollEl) return;

    const onScroll = () => setScrolled(scrollEl.scrollTop > 8);
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-50 overflow-visible transition-[background,box-shadow,border-color] duration-300",
        scrolled
          ? "border-b border-black/[0.06] bg-[#f5f7f6]/75 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-[#020304]/80 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="relative mx-auto flex min-h-[64px] max-w-6xl items-center justify-between overflow-visible px-5 py-2 sm:min-h-[68px]">
        {/* Start: theme & language */}
        <div className="z-10 flex items-center gap-0.5">
          <LanguageToggle
            side="bottom"
            align="start"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          />
          <ThemeToggle className="h-9 w-9 text-muted-foreground hover:text-foreground" />
        </div>

        {/* Center: brand */}
        <Link
          href="/"
          className="absolute left-1/2 top-0 z-20 flex h-full -translate-x-1/2 items-center outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
        >
          <LandingBrand showIcon={false} emphasis nativeName={t("landing.brand.nativeName")} />
        </Link>

        {/* End: auth */}
        <div className="z-10 flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="hidden px-2 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            {t("landing.cta.signin")}
          </Link>
          <Link
            href="/register"
            className="auth-cta-shimmer inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-bold text-white shadow-[0_4px_14px_-4px_var(--brand)] transition-transform hover:scale-[1.03] active:scale-[0.98] sm:h-9 sm:px-5 sm:text-[13px]"
          >
            {t("landing.cta.register")}
          </Link>
        </div>
      </div>
    </header>
  );
}
