"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Headphones, Radio, Zap, Music2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { AuthStageVisual } from "@/features/auth/components/auth-stage-visual";
import { RoomMockup } from "./room-mockup";

export function LandingHero() {
  const { t } = useTranslations();

  const badges = [
    { icon: Zap, key: "landing.badge.sync" as const },
    { icon: Headphones, key: "landing.badge.queue" as const },
    { icon: Radio, key: "landing.badge.explore" as const },
  ];

  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-10 pt-16 md:pt-24">
      <div className="flex flex-col items-center gap-16 text-center lg:flex-row lg:items-start lg:gap-10 lg:text-start">
        {/* ── Copy column ── */}
        <div className="flex flex-1 flex-col items-center lg:items-start">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-subtle px-4 py-1.5"
          >
            <span
              className="status-live h-1.5 w-1.5"
              style={{ animation: "auth-core-pulse 2.4s ease-in-out infinite" }}
            />
            <span className="text-[12px] font-semibold text-brand">
              {t("landing.eyebrow")}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut", delay: 0.15 }}
            className="mb-5 max-w-2xl font-display text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.06] tracking-tighter text-foreground"
          >
            {t("landing.headline1")}{" "}
            <span className="text-gradient-brand">
              {t("landing.headline2")}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
            className="mb-8 max-w-md text-[15px] leading-relaxed text-muted-foreground"
          >
            {t("landing.subtitle")}
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <Link
              href="/register"
              className="auth-cta-shimmer inline-flex h-11 items-center gap-2 rounded-2xl px-7 text-[14px] font-bold text-white shadow-[0_8px_28px_-6px_var(--brand)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Music2 className="h-4 w-4" strokeWidth={2.5} />
              {t("landing.cta.start")}
            </Link>
            <Link
              href="/explore"
              className="glass-panel inline-flex h-11 items-center rounded-2xl px-7 text-[14px] font-semibold text-foreground transition-all hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.18)] active:scale-[0.98]"
            >
              {t("landing.cta.explore")}
            </Link>
          </motion.div>

          {/* Feature badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.55 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
          >
            {badges.map(({ icon: Icon, key }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/60 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.04]"
              >
                <Icon className="h-3 w-3 text-brand/70" strokeWidth={2} aria-hidden />
                {t(key)}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── Visual column ── */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.3 }}
          className="w-full max-w-xs shrink-0 lg:w-[340px]"
        >
          <div className="animate-float-soft">
            <RoomMockup />
          </div>
        </motion.div>
      </div>

      {/* Stage visual / waveform */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut", delay: 0.6 }}
        className="mt-16"
      >
        <AuthStageVisual />
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="mt-10 flex flex-col items-center gap-1.5"
      >
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
          {t("landing.scrollHint")}
        </span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-5 w-px rounded-full bg-gradient-to-b from-muted-foreground/40 to-transparent"
        />
      </motion.div>
    </section>
  );
}
