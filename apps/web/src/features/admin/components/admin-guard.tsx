"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { getMe } from "@/lib/api";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    getMe()
      .then((res) => {
        if (res?.user?.is_superuser) setState("ok");
        else setState("forbidden");
      })
      .catch(() => setState("forbidden"));
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {t("guard.checkingSession")}
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <Alert tone="error" className="space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-5 w-5" aria-hidden />
            {t("admin.accessDenied")}
          </div>
          <p className="text-sm">{t("admin.accessDeniedHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
              {t("admin.backToApp")}
            </Button>
            <Link href="/login">
              <Button variant="outline">{t("guard.goToLogin")}</Button>
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
