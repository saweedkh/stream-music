"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { joinChannel } from "@/lib/api";

function JoinPendingInner() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel") ?? "";
  const [status, setStatus] = useState<"pending" | "joined" | "error">("pending");
  const [message, setMessage] = useState(() => t("page.join.pending.waiting"));

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const out = await joinChannel(channelId);
        if (cancelled) return;
        if (out.status === "joined") {
          setStatus("joined");
          setMessage(t("page.join.pending.approved"));
          window.location.href = `/channel/${out.channel}`;
          return;
        }
        if (out.status === "pending") {
          setStatus("pending");
          setMessage(t("page.join.pending.stillWaiting"));
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage(t("page.join.pending.checkFailed"));
        }
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [channelId, t]);

  return (
    <Card className="mx-auto max-w-md border-border/90">
      <CardHeader>
        <CardTitle>{t("page.join.pending.cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>{message}</Alert>
        {status === "joined" ? (
          <Button asChild className="w-full">
            <Link href={`/channel/${channelId}`}>{t("page.join.pending.openChannel")}</Link>
          </Button>
        ) : (
          <Button asChild variant="secondary" className="w-full">
            <Link href="/dashboard">{t("page.join.pending.dashboard")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function JoinPendingPage() {
  const { t } = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{t("common.loading")}</p>}>
      <JoinPendingInner />
    </Suspense>
  );
}
