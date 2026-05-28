"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import { joinChannelFromLink } from "@/lib/api";

export function JoinPrivateInviteClient({ token }: { token: string }) {
  const { t } = useTranslations();
  const router = useRouter();
  const [message, setMessage] = useState(() => t("join.landing.connecting"));

  useEffect(() => {
    const raw = token.trim();
    if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
      setMessage(t("join.private.invalidCode"));
      return;
    }
    let cancelled = false;
    joinChannelFromLink(raw.toLowerCase())
      .then((out) => {
        if (cancelled) return;
        if (out.status === "pending") {
          setMessage(t("join.landing.pending"));
          return;
        }
        router.replace(`/channel/${out.channel}`);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setMessage(e instanceof Error ? e.message : t("join.landing.failed"));
      });
    return () => {
      cancelled = true;
    };
  }, [router, token, t]);

  return (
    <div className="space-y-3 text-sm text-foreground/80">
      <p className="text-base font-medium text-foreground">{t("join.private.title")}</p>
      <p>{message}</p>
    </div>
  );
}
