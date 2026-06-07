"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";

type LandingFeatureItemProps = {
  icon: LucideIcon;
  titleKey: MessageKey;
  descKey: MessageKey;
  index: number;
};

export function LandingFeatureItem({
  icon: Icon,
  titleKey,
  descKey,
  index,
}: LandingFeatureItemProps) {
  const { t } = useTranslations();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.05 }}
      className="group"
    >
      <div className="mb-4 inline-flex text-brand">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
      </div>

      <h3 className="mb-2 font-display text-[15px] font-medium tracking-tight text-foreground">
        {t(titleKey)}
      </h3>

      <p className="max-w-[32ch] text-[13px] leading-[1.7] text-muted-foreground">
        {t(descKey)}
      </p>
    </motion.div>
  );
}
