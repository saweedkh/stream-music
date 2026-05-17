"use client";

import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { useTranslations } from "@/components/providers/locale-provider";
import { AuthForm } from "@/features/auth/auth-form";

export function RegisterScreen() {
  const { t } = useTranslations();

  return (
    <AuthLayout title={t("auth.createYourAccount")} description={t("auth.registerDescription")}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">{t("common.loading")}</p>}>
        <AuthForm mode="register" />
      </Suspense>
    </AuthLayout>
  );
}
