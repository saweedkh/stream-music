"use client";

import { useTranslations } from "@/shared/providers/locale-provider";
import { LANDING_FEATURES } from "../model/landing-features";
import { LandingFeatureItem } from "./landing-feature-item";
import { LandingSectionHeader } from "./landing-section-header";

export function LandingFeatures() {
  const { t } = useTranslations();

  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-24">
      <LandingSectionHeader
        eyebrowKey="landing.features.eyebrow"
        subtitleKey="landing.features.subtitle"
        title={
          <>
            {t("landing.features.title1")}{" "}
            <span className="text-gradient-brand">{t("landing.features.title2")}</span>
          </>
        }
      />

      <div className="grid gap-12 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-14 lg:grid-cols-3">
        {LANDING_FEATURES.map((feature, index) => (
          <LandingFeatureItem
            key={feature.id}
            icon={feature.icon}
            titleKey={feature.titleKey}
            descKey={feature.descKey}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
