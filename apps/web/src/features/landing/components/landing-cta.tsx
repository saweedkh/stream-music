"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Music2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";

export function LandingCta() {
  const { t } = useTranslations();

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-panel-elevated relative overflow-hidden px-8 py-16 text-center"
      >
        {/* Ambient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 50% 110%, var(--glow-brand), transparent 60%)",
          }}
        />
        {/* Grid dots pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand shadow-[0_8px_32px_-8px_var(--brand)]">
            <Music2 className="h-7 w-7 text-brand-foreground" strokeWidth={2.5} />
          </div>

          {/* Headline */}
          <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight text-foreground">
            {t("landing.cta.section.title1")}{" "}
            <span className="text-gradient-brand">
              {t("landing.cta.section.title2")}
            </span>
          </h2>

          <p className="mx-auto mb-8 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            {t("landing.cta.section.desc")}
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="auth-cta-shimmer inline-flex h-12 items-center rounded-2xl px-8 text-[15px] font-bold text-brand-foreground shadow-[0_8px_32px_-6px_var(--brand)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("landing.cta.section.primary")}
            </Link>
            <Link
              href="/login"
              className="glass-panel inline-flex h-12 items-center rounded-2xl px-8 text-[15px] font-semibold text-foreground transition-all hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)] active:scale-[0.98]"
            >
              {t("landing.cta.section.secondary")}
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
