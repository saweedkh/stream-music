"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";

type LandingSectionHeaderProps = {
  eyebrowKey: MessageKey;
  title: ReactNode;
  subtitleKey?: MessageKey;
  className?: string;
};

export function LandingSectionHeader({
  eyebrowKey,
  title,
  subtitleKey,
  className = "mb-12 text-center",
}: LandingSectionHeaderProps) {
  const { t } = useTranslations();

  return (
    <div className={className}>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4 }}
        className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-brand"
      >
        {t(eyebrowKey)}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.07 }}
        className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-bold tracking-tight text-foreground"
      >
        {title}
      </motion.h2>
      {subtitleKey ? (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.14 }}
          className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground"
        >
          {t(subtitleKey)}
        </motion.p>
      ) : null}
    </div>
  );
}
