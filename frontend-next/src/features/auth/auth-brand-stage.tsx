"use client";

import { motion } from "framer-motion";
import { Heart, MessageSquare, Users } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { AuthStageVisual } from "@/features/auth/auth-stage-visual";
import { authStageContainer, authStageItem } from "@/lib/motion";

const FEATURES = [
  { titleKey: "auth.feature.liveRooms" as const, descKey: "auth.feature.liveRoomsDesc" as const, icon: Users },
  { titleKey: "auth.feature.sharedQueue" as const, descKey: "auth.feature.sharedQueueDesc" as const, icon: MessageSquare },
  { titleKey: "auth.feature.publicExplore" as const, descKey: "auth.feature.publicExploreDesc" as const, icon: Heart },
] as const;

function AuthStageWaves() {
  return (
    <>
      <svg
        className="auth-stage-waves pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[62%] w-full"
        viewBox="0 0 1440 560"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="authWaveA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <filter id="authWaveBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <path
          filter="url(#authWaveBlur)"
          fill="url(#authWaveA)"
          d="M0,320 C240,140 420,380 680,260 C920,160 1120,340 1440,240 L1440,560 L0,560 Z"
        />
        <path fill="#22c55e" fillOpacity="0.09" d="M0,380 C320,300 560,420 820,340 C1040,280 1240,400 1440,360 L1440,560 L0,560 Z" />
        <path fill="#34d399" fillOpacity="0.06" d="M0,430 C400,390 720,460 1080,400 C1260,380 1360,420 1440,410 L1440,560 L0,560 Z" />
      </svg>
      <div className="auth-stage-fog auth-stage-fog--1" aria-hidden />
      <div className="auth-stage-fog auth-stage-fog--2" aria-hidden />
    </>
  );
}

/** Desktop-only branding panel (hidden on mobile). */
export function AuthBrandStage() {
  const { t } = useTranslations();

  return (
    <aside className="auth-stage hidden min-h-dvh overflow-hidden lg:flex lg:flex-col">
      <div className="auth-stage-orb auth-stage-orb--1" aria-hidden />
      <div className="auth-stage-orb auth-stage-orb--2" aria-hidden />
      <div className="auth-stage-orb auth-stage-orb--3" aria-hidden />
      <AuthStageWaves />

      <motion.div
        className="relative z-[2] flex min-h-0 flex-1 flex-col justify-between px-10 py-11 xl:px-14 xl:py-12"
        {...authStageContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={authStageItem} className="flex flex-1 flex-col items-center justify-center text-center">
          <AuthStageVisual />
          <h1 className="auth-stage-headline mt-12">
            {t("auth.stageTitle")}{" "}
            <span className="auth-stage-headline-accent">{t("auth.stageTitleAccent")}</span>
          </h1>
          <p className="auth-stage-subtitle mt-4 max-w-md">{t("auth.stageSubtitle")}</p>
        </motion.div>

        <motion.ul variants={authStageItem} className="grid grid-cols-3 gap-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.titleKey} className="auth-feature-card">
                <span className="auth-feature-icon">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="auth-feature-title">{t(feature.titleKey)}</p>
                  <p className="auth-feature-desc">{t(feature.descKey)}</p>
                </div>
              </li>
            );
          })}
        </motion.ul>
      </motion.div>
    </aside>
  );
}
