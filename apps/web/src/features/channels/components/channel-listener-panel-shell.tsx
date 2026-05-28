"use client";

import type { LucideIcon } from "lucide-react";
import { Info, ListMusic, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { LISTENER_TAB_META } from "@/features/channels/components/channel-listener-nav-meta";
import type { ListenerTabId } from "@/features/channels/components/channel-room-config";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { panelLgCage, panelMobileFlat } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<Exclude<ListenerTabId, "chat">, LucideIcon> = {
  suggestions: Sparkles,
  queue: ListMusic,
  info: Info,
};

type Props = {
  tab: Exclude<ListenerTabId, "chat">;
  children: ReactNode;
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
        "relative flex flex-1 flex-col",
        panelMobileFlat,
        panelLgCage,
        "lg:min-h-0 lg:max-h-full lg:overflow-hidden",
        "lg:shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_-24px_rgba(0,0,0,0.75)]",
        "lg:before:pointer-events-none lg:before:absolute lg:before:inset-0 lg:before:rounded-2xl lg:before:bg-[radial-gradient(700px_circle_at_20%_-10%,rgba(52,211,153,0.1),transparent_50%)]",
        className,
      )}
    >
      <header className="relative z-[1] flex shrink-0 items-start gap-3 border-b border-border/40 px-3 py-2.5 sm:px-4 lg:bg-[var(--surface-inset)] lg:px-5 lg:py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand lg:size-10 lg:rounded-2xl">
          <Icon className="size-4 lg:size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{t(meta.titleKey)}</h2>
            {badge}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{t(meta.descriptionKey)}</p>
        </div>
      </header>

      <div className="relative z-[1] flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden lg:p-2 lg:sm:p-3">
        <div className="flex flex-1 flex-col px-1 py-2 sm:px-2 sm:py-3 max-lg:overflow-visible lg:hidden">{children}</div>
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
          <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/40 bg-[var(--surface-inset)]">
            <div className="p-3 sm:p-4">{children}</div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
