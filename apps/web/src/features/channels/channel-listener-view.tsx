"use client";

import { Users } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { listenerItemClass } from "@/features/channels/channel-listener-panel-styles";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ChannelRoomLoading() {
  const { t } = useTranslations();
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col gap-5 px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-border/80 bg-background/55 p-6 sm:p-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-border/80 bg-background/55 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
      <p className="text-center text-sm text-muted-foreground">{t("room.loading.access")}</p>
    </div>
  );
}

type MetaProps = {
  description?: string;
  memberLimit?: number;
  joinRequiresApproval?: boolean;
  experience?: import("@/features/experience/room-experience-chrome").ChannelExperience;
  onlineCount?: number | null;
};

export function ChannelListenerMeta({
  description,
  memberLimit,
  joinRequiresApproval,
  experience,
  onlineCount,
}: MetaProps) {
  const { t } = useTranslations();
  const hasMeta =
    Boolean(description?.trim()) ||
    typeof memberLimit === "number" ||
    joinRequiresApproval ||
    Boolean(experience?.room_rules?.trim()) ||
    onlineCount != null;

  if (!hasMeta) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-10 text-center text-sm leading-relaxed text-muted-foreground">
        {t("room.listener.tab.info.description")}
      </p>
    );
  }

  const sectionClass = cn("p-4 sm:p-5", listenerItemClass);

  return (
    <div className="space-y-3">
      {onlineCount != null ? (
        <section className={cn("flex items-center gap-3", sectionClass)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {onlineCount} {t("room.listener.online")}
            </p>
            <p className="text-xs text-muted-foreground">{t("room.listener.syncHint")}</p>
          </div>
        </section>
      ) : null}

      {description?.trim() ? (
        <section className={sectionClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("room.listener.tab.info.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{description.trim()}</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {typeof memberLimit === "number" ? (
          <Badge variant="outline" className="text-muted-foreground">
            {t("channels.cap", { count: memberLimit })}
          </Badge>
        ) : null}
        {joinRequiresApproval ? (
          <Badge variant="warning" className="text-[10px] sm:text-xs">
            {t("channels.approvalRequired")}
          </Badge>
        ) : null}
      </div>

      {experience?.room_rules?.trim() ? (
        <section className={sectionClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("room.listener.roomRules")}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {experience.room_rules.trim()}
          </p>
        </section>
      ) : null}
    </div>
  );
}
