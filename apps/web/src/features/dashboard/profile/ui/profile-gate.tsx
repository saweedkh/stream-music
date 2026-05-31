"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { WorkspaceEmpty } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";

export function ProfileGate() {
  const { t } = useTranslations();

  return (
    <WorkspaceEmpty icon={User} title={t("guard.notLoggedIn")} className="py-14">
      <p className="mb-4 text-sm text-muted-foreground">{t("auth.needAccount")}</p>
      <Button asChild>
        <Link href="/login">{t("guard.goToLogin")}</Link>
      </Button>
    </WorkspaceEmpty>
  );
}
