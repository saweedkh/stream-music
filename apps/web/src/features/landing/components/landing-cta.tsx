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
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-xl text-center"
      >
        <h2 className="mb-3 font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-foreground">
          {t("landing.cta.section.title1")}{" "}
          <span className="text-gradient-brand">{t("landing.cta.section.title2")}</span>
        </h2>

        <p className="mb-8 text-[14px] leading-relaxed text-muted-foreground">
          {t("landing.cta.section.desc")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="auth-cta-shimmer inline-flex h-11 items-center gap-2 rounded-2xl px-7 text-[14px] font-bold text-white shadow-[0_8px_28px_-6px_var(--brand)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Music2 className="h-4 w-4" strokeWidth={2.5} />
            {t("landing.cta.section.primary")}
          </Link>
          <Link
            href="/login"
            className="glass-panel inline-flex h-11 items-center rounded-2xl px-7 text-[14px] font-semibold text-foreground transition-all hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.18)] active:scale-[0.98]"
          >
            {t("landing.cta.section.secondary")}
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
