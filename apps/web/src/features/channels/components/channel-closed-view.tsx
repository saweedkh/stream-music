"use client";

import Link from "next/link";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

export function ChannelClosedView() {
  const { t } = useTranslations();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-foreground">{t("page.channelClosed.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("page.channelClosed.description")}</p>
      <Button asChild variant="secondary">
        <Link href="/dashboard">{t("page.channelClosed.back")}</Link>
      </Button>
    </div>
  );
}
