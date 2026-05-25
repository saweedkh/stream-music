"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "@/components/providers/locale-provider";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AuthBrandStage } from "@/features/auth/auth-brand-stage";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthPanelLogo } from "@/features/auth/auth-panel-logo";
import { authFormPanel } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

export function AuthExperience({ mode: initialMode }: { mode: AuthMode }) {
  const { t } = useTranslations();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  return (
    <div className="relative grid min-h-dvh grid-cols-1 overflow-hidden bg-gradient-to-b from-[#f5f7f6] via-[#eef1ef] to-[#e8ede9] text-slate-900 dark:from-[#020304] dark:via-[#060809] dark:to-[#040606] dark:text-slate-100 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
      {/* Waves */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <svg className="absolute inset-x-0 bottom-0 h-[62%] w-full" viewBox="0 0 1440 560" preserveAspectRatio="none">
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.09" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.02" />
              <stop offset="40%" stopColor="#22c55e" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="waveGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.025" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.015" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <g style={{ animation: "auth-wave-1 7s ease-in-out infinite" }}>
            <path fill="url(#waveGrad1)" d="M0,320 C240,140 420,380 680,260 C920,160 1120,340 1440,240 L1440,560 L0,560 Z" />
          </g>
          <g style={{ animation: "auth-wave-2 5s ease-in-out infinite" }}>
            <path fill="url(#waveGrad2)" d="M0,380 C320,300 560,420 820,340 C1040,280 1240,400 1440,360 L1440,560 L0,560 Z" />
          </g>
          <g style={{ animation: "auth-wave-3 9s ease-in-out infinite" }}>
            <path fill="url(#waveGrad3)" d="M0,430 C400,390 720,460 1080,400 C1260,380 1360,420 1440,410 L1440,560 L0,560 Z" />
          </g>
        </svg>
      </div>

      <AuthBrandStage />

      <div className="relative z-[1] flex min-h-dvh flex-col">
        {/* Form center */}
        <motion.div
          className="relative z-[1] flex flex-1 items-center justify-center px-5 pb-6 pt-10 sm:px-8 lg:px-10 lg:py-10"
          {...authFormPanel}
        >
          <div className="w-full max-w-[26rem] rounded-2xl border border-black/[0.06] bg-white/80 p-6 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0c0f14] dark:shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)] sm:p-8 lg:rounded-3xl lg:p-10">
            <div className="relative z-[1] flex flex-col gap-7">
              {/* Head */}
              <header className="flex flex-col items-center gap-2 text-center">
                <AuthPanelLogo />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/80">
                  {t("auth.stageEyebrow")}
                </p>
              </header>

              {/* Tabs */}
              <div className="relative flex" role="tablist">
                {(["login", "register"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab}
                    className={cn(
                      "relative flex-1 pb-2.5 text-sm font-semibold transition-colors duration-200",
                      mode === tab
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                    )}
                    onClick={() => setMode(tab)}
                  >
                    {tab === "login" ? t("auth.login") : t("auth.signUp")}
                    {mode === tab && (
                      <motion.span
                        layoutId="auth-tab-underline"
                        className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-brand"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
                <span className="absolute inset-x-0 bottom-0 h-px bg-slate-200/70 dark:bg-white/[0.06]" aria-hidden />
              </div>

              {/* Form */}
              <AuthForm mode={mode} onSwitchMode={setMode} />

              {/* Settings */}
              <div className="flex items-center justify-center gap-1 pt-1">
                <LanguageToggle side="top" align="center" className="h-8 w-8 rounded-lg text-slate-300 transition-colors hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300" />
                <ThemeToggle className="h-8 w-8 rounded-lg text-slate-300 transition-colors hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
