"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageSquare, Music, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/lib/notifications/store";
import type { AppNotification, NotificationCategory } from "@/lib/notifications/types";

const CATEGORY_META: Record<
  NotificationCategory,
  { labelKey: MessageKey; icon: typeof MessageSquare; className: string }
> = {
  chat: { labelKey: "notifications.category.chat", icon: MessageSquare, className: "text-sky-400 bg-sky-500/15" },
  playback: { labelKey: "notifications.category.playback", icon: Music, className: "text-brand bg-brand/15" },
  moderation: {
    labelKey: "notifications.category.moderation",
    icon: Shield,
    className: "text-amber-400 bg-amber-500/15",
  },
  system: { labelKey: "notifications.category.system", icon: Bell, className: "text-muted-foreground bg-muted/30" },
};

const CATEGORY_ORDER: NotificationCategory[] = ["chat", "playback", "moderation", "system"];

function formatWhen(ts: number, t: (key: MessageKey, vars?: Record<string, string | number>) => string): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return t("notifications.justNow");
  if (diff < 3_600_000) return t("notifications.minutesAgo", { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t("notifications.hoursAgo", { count: Math.floor(diff / 3_600_000) });
  return new Date(ts).toLocaleDateString();
}

function NotificationRow({
  item,
  onOpen,
  t,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const meta = CATEGORY_META[item.category];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        item.read
          ? "border-border/60 bg-card/30 hover:bg-card/50"
          : "border-brand/25 bg-brand/5 hover:bg-brand/10",
      )}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.className)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide">
            {t(meta.labelKey)}
          </Badge>
        </span>
        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
        <span className="mt-1 block text-[10px] text-muted-foreground">{formatWhen(item.createdAt, t)}</span>
      </span>
    </button>
  );
}

type NotificationCenterProps = {
  triggerClassName?: string;
  iconClassName?: string;
};

export function NotificationCenter({ triggerClassName, iconClassName }: NotificationCenterProps = {}) {
  const { t } = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clear = useNotificationStore((s) => s.clear);
  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const grouped = useMemo(() => {
    const map = new Map<NotificationCategory, AppNotification[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);

  function openItem(item: AppNotification) {
    markRead(item.id);
    setOpen(false);
    router.push(item.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "relative h-9 w-9 shrink-0 px-0 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            triggerClassName,
          )}
          aria-label={unread > 0 ? t("notifications.unread", { count: unread }) : t("notifications.open")}
        >
          <Bell className={cn("h-4 w-4", iconClassName)} />
          {unread > 0 ? (
            <Badge
              variant="success"
              className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 py-0 text-[10px] font-semibold text-brand-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[200] w-[min(100vw-2rem,22rem)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">{t("notifications.title")}</span>
          {items.length > 0 ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => markAllRead()}
                title={t("notifications.markAllRead")}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="sr-only">{t("notifications.markAllRead")}</span>
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => clear()} title={t("notifications.clearAll")}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">{t("notifications.clearAll")}</span>
              </Button>
            </div>
          ) : null}
        </div>

        <Separator />

        <ScrollArea className="max-h-[min(70vh,24rem)]">
          <div className="p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t("notifications.empty")}
              </p>
            ) : (
              CATEGORY_ORDER.map((cat) => {
                const list = grouped.get(cat) ?? [];
                if (list.length === 0) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <section key={cat} className="mb-3 last:mb-0">
                    <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t(meta.labelKey)}
                    </h3>
                    <ul className="space-y-1.5">
                      {list.map((item) => (
                        <li key={item.id}>
                          <NotificationRow item={item} onOpen={openItem} t={t} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="px-3 py-2 text-center">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-brand" onClick={() => setOpen(false)}>
            {t("notifications.pushSettings")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
