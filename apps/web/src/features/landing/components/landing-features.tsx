"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Radio, MessageCircle, ListMusic, Users, Compass, Smartphone } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";

type Feature = {
  icon: LucideIcon;
  titleKey: MessageKey;
  descKey: MessageKey;
};

const FEATURES: Feature[] = [
  { icon: Radio,         titleKey: "landing.feat.sync.title",        descKey: "landing.feat.sync.desc" },
  { icon: MessageCircle, titleKey: "landing.feat.chat.title",        descKey: "landing.feat.chat.desc" },
  { icon: ListMusic,     titleKey: "landing.feat.queue.title",       descKey: "landing.feat.queue.desc" },
  { icon: Users,         titleKey: "landing.feat.rooms.title",       descKey: "landing.feat.rooms.desc" },
  { icon: Compass,       titleKey: "landing.feat.discover.title",    descKey: "landing.feat.discover.desc" },
  { icon: Smartphone,    titleKey: "landing.feat.everywhere.title",  descKey: "landing.feat.everywhere.desc" },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const { t } = useTranslations();
  const { icon: Icon, titleKey, descKey } = feature;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: (index % 3) * 0.07 }}
      className="surface-card group relative cursor-default overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.1),0_0_0_1px_color-mix(in_srgb,var(--brand)_12%,transparent)]"
    >
      {/* hover glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 110%, var(--glow-brand), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-subtle text-brand ring-1 ring-brand/20">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </div>
        <h3 className="mb-2 font-display text-[15px] font-semibold text-foreground">
          {t(titleKey)}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t(descKey)}
        </p>
      </div>
    </motion.div>
  );
}

export function LandingFeatures() {
  const { t } = useTranslations();

  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-24">
      {/* Section header */}
      <div className="mb-12 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-brand"
        >
          {t("landing.features.eyebrow")}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.07 }}
          className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-bold tracking-tight text-foreground"
        >
          {t("landing.features.title1")}{" "}
          <span className="text-gradient-brand">{t("landing.features.title2")}</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.14 }}
          className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground"
        >
          {t("landing.features.subtitle")}
        </motion.p>
      </div>

      {/* Grid */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.titleKey} feature={f} index={i} />
        ))}
      </div>
    </section>
  );
}
