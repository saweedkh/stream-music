"use client";

import type { LucideIcon } from "lucide-react";
import { Info, ListMusic, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import { LISTENER_TAB_META } from "@/features/channels/channel-listener-nav-meta";
import type { ListenerTabId } from "@/features/channels/channel-room-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<Exclude<ListenerTabId, "chat">, LucideIcon> = {
  suggestions: Sparkles,
  queue: ListMusic,
  info: Info,
};

type Props = {
  tab: Exclude<ListenerTabId, "chat">;
  children: ReactNode;
  /** Optional status chip next to title (e.g. queue count). */
  badge?: ReactNode;
  className?: string;
};

export function ChannelListenerPanelShell({ tab, children, badge, className }: Props) {
  const { t } = useTranslations();
  const meta = LISTENER_TAB_META[tab];
  const Icon = TAB_ICONS[tab];

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-2xl",
        "border border-border/60 bg-gradient-to-br from-background/95 via-[var(--brand-subtle)] to-background/95 backdrop-blur-2xl",
        "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_-24px_rgba(0,0,0,0.75)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-[radial-gradient(700px_circle_at_20%_-10%,rgba(52,211,153,0.1),transparent_50%)]",
        className,
      )}
    >
      <header className="relative z-[1] flex shrink-0 items-start gap-3 border-b border-border/40 bg-[var(--surface-inset)] px-4 py-3 sm:px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{t(meta.titleKey)}</h2>
            {badge}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{t(meta.descriptionKey)}</p>
        </div>
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/40 bg-[var(--surface-inset)]">
          <div className="p-3 sm:p-4">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
