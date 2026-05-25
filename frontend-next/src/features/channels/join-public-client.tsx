"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import { joinChannelFromLink } from "@/lib/api";

export function JoinPublicClient({ slug }: { slug: string }) {
  const { t } = useTranslations();
  const router = useRouter();
  const [message, setMessage] = useState(() => t("join.landing.connecting"));

  useEffect(() => {
    const raw = slug.trim();
    if (!raw) {
      setMessage(t("join.landing.missingLink"));
      return;
    }
    let cancelled = false;
    joinChannelFromLink(raw)
      .then((out) => {
        if (cancelled) return;
        if (out.status === "pending") {
          router.replace("/join/pending");
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
  }, [router, slug, t]);

  return (
    <div className="space-y-3 text-sm text-foreground/80">
      <p className="text-base font-medium text-foreground">{t("join.landing.title")}</p>
      <p>{message}</p>
    </div>
  );
}
