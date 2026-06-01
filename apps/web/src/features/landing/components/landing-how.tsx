"use client";

import { motion } from "framer-motion";
import { useTranslations } from "@/shared/providers/locale-provider";

const STEP_NUMBERS = ["۱", "۲", "۳"] as const;

type StepKey = {
  title: "landing.how.step1.title" | "landing.how.step2.title" | "landing.how.step3.title";
  desc: "landing.how.step1.desc" | "landing.how.step2.desc" | "landing.how.step3.desc";
};

const STEPS: StepKey[] = [
  { title: "landing.how.step1.title", desc: "landing.how.step1.desc" },
  { title: "landing.how.step2.title", desc: "landing.how.step2.desc" },
  { title: "landing.how.step3.title", desc: "landing.how.step3.desc" },
];

export function LandingHow() {
  const { t } = useTranslations();

  return (
    <section id="how" className="relative py-16">
      {/* subtle mid-page glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 50% at 50% 50%, var(--glow-brand), transparent 70%)",
          opacity: 0.4,
        }}
      />
      <div className="relative mx-auto max-w-6xl px-5">
        {/* Section header */}
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4 }}
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-brand"
          >
            {t("landing.how.eyebrow")}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.07 }}
            className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-bold tracking-tight text-foreground"
          >
            {t("landing.how.title")}
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="mx-auto max-w-xl">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }}
              className="relative flex gap-5 pb-10 last:pb-0"
            >
              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="absolute start-[23px] top-12 h-[calc(100%-3rem)] w-px bg-gradient-to-b from-brand/30 via-brand/15 to-transparent"
                />
              )}

              {/* Step number */}
              <div className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand font-display text-lg font-bold text-brand-foreground shadow-[0_8px_24px_-6px_var(--brand)]">
                  {STEP_NUMBERS[i]}
                </div>
                <div
                  aria-hidden
                  className="absolute -inset-2 -z-10 rounded-3xl opacity-20 blur-lg"
                  style={{
                    background: "radial-gradient(circle, var(--brand-muted), transparent 70%)",
                  }}
                />
              </div>

              {/* Content */}
              <div className="pt-2">
                <h3 className="mb-1.5 font-display text-[16px] font-semibold text-foreground">
                  {t(step.title)}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {t(step.desc)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
