"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { joinChannelFromLink } from "@/lib/api";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";

export function JoinLandingClient() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(() => t("join.landing.connecting"));

  useEffect(() => {
    const link = searchParams.get("link")?.trim();
    const legacyChannel = searchParams.get("channel")?.trim();
    if (legacyChannel && !link) {
      setMessage(t("join.landing.legacyUnsupported"));
      return;
    }
    const payloadRaw = link ?? "";
    const payload = payloadRaw ? extractJoinInputFromScannedText(payloadRaw) : "";
    if (!payload) {
      setMessage(t("join.landing.missingLink"));
      return;
    }
    let cancelled = false;
    joinChannelFromLink(payload)
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
  }, [router, searchParams, t]);

  return (
    <div className="space-y-3 text-sm text-foreground/80">
      <p className="text-base font-medium text-foreground">{t("join.landing.title")}</p>
      <p>{message}</p>
    </div>
  );
}
