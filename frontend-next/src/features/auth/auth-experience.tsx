"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "@/components/providers/locale-provider";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AuthBrandStage } from "@/features/auth/auth-brand-stage";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthFormAmbient } from "@/features/auth/auth-form-ambient";
import { AuthPanelLogo } from "@/features/auth/auth-panel-logo";
import { AuthStageVisual } from "@/features/auth/auth-stage-visual";
import { authFormPanel, authTabSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

function authHref(mode: AuthMode, next: string | null): string {
  const base = mode === "login" ? "/login" : "/register";
  if (!next || !next.startsWith("/") || next.startsWith("//")) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

function AuthTabs({ mode }: { mode: AuthMode }) {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const tabs: { mode: AuthMode; labelKey: "auth.login" | "auth.signUp" }[] = [
    { mode: "login", labelKey: "auth.login" },
    { mode: "register", labelKey: "auth.signUp" },
  ];

  return (
    <div className="auth-tabs" role="tablist" aria-label={t("auth.login")}>
      {tabs.map((tab) => {
        const active = mode === tab.mode;
        return (
          <Link
            key={tab.mode}
            href={authHref(tab.mode, next)}
            role="tab"
            className={cn("auth-tab", active && "auth-tab--active")}
            aria-current={active ? "page" : undefined}
            aria-selected={active}
          >
            {active ? (
              <motion.span layoutId="auth-tab-indicator" className="auth-tab-indicator" transition={authTabSpring} aria-hidden />
            ) : null}
            <span className="relative z-[1]">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </div>
  );
}

type AuthExperienceProps = {
  mode: AuthMode;
};

export function AuthExperience({ mode }: AuthExperienceProps) {
  const { t } = useTranslations();
  const isLogin = mode === "login";

  return (
    <div className="auth-page">
      <AuthBrandStage />

      <div className="auth-form-column">
        <AuthFormAmbient />
        <div className="auth-form-toolbar">
          <LanguageToggle className="text-muted-foreground hover:text-foreground" />
          <ThemeToggle className="text-muted-foreground hover:text-foreground" />
        </div>

        <motion.div className="auth-form-center" {...authFormPanel}>
          <div className="auth-panel-card">
            <div className="auth-mobile-hero lg:hidden">
              <AuthStageVisual className="max-w-[220px]" />
              <p className="auth-mobile-eyebrow">{t("auth.stageEyebrow")}</p>
              <h2 className="auth-mobile-title">
                {isLogin ? t("auth.welcomeBack") : t("auth.createYourAccount")}
              </h2>
              <p className="auth-mobile-subtitle">
                {isLogin ? t("auth.loginDescription") : t("auth.registerDescription")}
              </p>
            </div>

            <div className="hidden lg:block">
              <AuthPanelLogo />
            </div>
            <div className="auth-panel-logo-compact lg:hidden">
              <AuthPanelLogo />
            </div>

            <div className="auth-panel-welcome hidden lg:block">
              <h2 className="auth-panel-welcome-title">
                {isLogin ? t("auth.welcomeBack") : t("auth.createYourAccount")}
              </h2>
              <p className="auth-panel-welcome-desc">
                {isLogin ? t("auth.loginDescription") : t("auth.registerDescription")}
              </p>
            </div>

            <div className="auth-panel-tabs">
              <Suspense fallback={<div className="auth-tabs auth-tabs--skeleton" aria-hidden />}>
                <AuthTabs mode={mode} />
              </Suspense>
            </div>

            <div className="auth-panel-body">
              <Suspense fallback={<p className="auth-panel-loading">{t("common.loading")}</p>}>
                <AuthForm mode={mode} />
              </Suspense>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
