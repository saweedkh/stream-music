"use client";

import type { SupportSocketState } from "@/shared/hooks/use-support-ticket-socket";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  state: SupportSocketState;
  className?: string;
};

export function SupportSocketBadge({ state, className }: Props) {
  const { t } = useTranslations();
  const connected = state === "connected";

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        connected ? "bg-brand/15 text-brand" : "bg-amber-500/15 text-warning",
        className,
      )}
    >
      {connected
        ? t("support.live")
        : state === "closed"
          ? t("support.offline")
          : state === "reconnecting"
            ? t("support.reconnecting")
            : t("common.connecting")}
    </span>
  );
}
