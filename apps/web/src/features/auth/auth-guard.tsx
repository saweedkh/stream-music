"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/api";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslations();
  const [state, setState] = useState<"loading" | "ok" | "unauthorized">("loading");

  useEffect(() => {
    getMe()
      .then((res) => setState(res?.user ? "ok" : "unauthorized"))
      .catch(() => setState("unauthorized"));
  }, []);

  if (state === "loading") {
    return (
      <div className="surface-card rounded-2xl p-4 text-sm text-muted-foreground">
        {t("guard.checkingSession")}
      </div>
    );
  }
  if (state === "unauthorized") {
    return (
      <Alert tone="error" className="space-y-3 rounded-2xl border-rose-800/70 bg-rose-950/30 p-4">
        <p>{t("guard.notLoggedIn")}</p>
        <Link href="/login">
          <Button>{t("guard.goToLogin")}</Button>
        </Link>
      </Alert>
    );
  }
  return <>{children}</>;
}
