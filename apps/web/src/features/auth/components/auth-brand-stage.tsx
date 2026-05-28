"use client";

import { motion } from "framer-motion";
import { Headphones, Radio, Zap } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { AuthStageVisual } from "@/features/auth/components/auth-stage-visual";
import { authStageContainer, authStageItem } from "@/lib/motion";

const FEATURES = [
  { titleKey: "auth.feature.liveRooms" as const, icon: Zap },
  { titleKey: "auth.feature.sharedQueue" as const, icon: Headphones },
  { titleKey: "auth.feature.publicExplore" as const, icon: Radio },
] as const;

export function AuthBrandStage() {
  const { t } = useTranslations();

  return (
    <aside className="relative z-[1] hidden h-dvh min-h-0 min-w-0 overflow-hidden lg:flex lg:flex-col">
      <motion.div
        className="relative z-[2] flex min-h-0 flex-1 flex-col items-center justify-center px-10 py-11 xl:px-14 xl:py-12"
        {...authStageContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={authStageItem} className="flex flex-col items-center text-center">
          <AuthStageVisual />
          <h1 className="text-center font-display text-[clamp(2.5rem,4vw,3.75rem)] font-bold leading-[1.05] tracking-tighter text-slate-900 dark:text-white">
            {t("auth.stageTitle")}{" "}
            <span className="text-emerald-500 drop-shadow-[0_0_36px_rgba(34,197,94,0.35)] dark:text-emerald-400 dark:drop-shadow-[0_0_36px_rgba(34,197,94,0.45)]">
              {t("auth.stageTitleAccent")}
            </span>
          </h1>
          <p className="mt-12 max-w-md text-center text-base leading-relaxed text-slate-500 dark:text-slate-400">
            {t("auth.stageSubtitle")}
          </p>
        </motion.div>

        <motion.div variants={authStageItem} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <span
                key={feature.titleKey}
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.03] px-4 py-2 text-[13px] font-medium text-slate-500 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/50"
              >
                <Icon className="h-3.5 w-3.5 text-emerald-500/70 dark:text-emerald-400/70" strokeWidth={2} aria-hidden />
                {t(feature.titleKey)}
              </span>
            );
          })}
        </motion.div>
      </motion.div>
    </aside>
  );
}
