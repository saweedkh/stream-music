"use client";

import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import {
  CHANNEL_GROUP_LABELS,
  channelNavItemsForContext,
  type ChannelTabGroup,
  type ChannelTabId,
} from "@/features/channels/channel-room-config";

type Props = {
  activeTab: ChannelTabId;
  tabGroup: ChannelTabGroup;
  canManage: boolean;
  onTabChange: (tab: ChannelTabId) => void;
  onGroupChange: (group: ChannelTabGroup) => void;
  header: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  mobileBar?: ReactNode;
  className?: string;
};

export function ChannelRoomShell({
  activeTab,
  tabGroup,
  canManage,
  onTabChange,
  onGroupChange,
  header,
  children,
  sidebar,
  mobileBar,
  className,
}: Props) {
  const navItems = channelNavItemsForContext(canManage, tabGroup);
  const groups = (["listen", "social", "dj"] as ChannelTabGroup[]).filter((g) => canManage || g !== "dj");

  return (
    <div className={cn("space-y-5 pb-28", className)}>
      <motion.div {...fadeUp}>{header}</motion.div>

      {canManage ? (
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.04 }}
          className="flex flex-wrap gap-2"
        >
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => onGroupChange(group)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200",
                tabGroup === group
                  ? "border-brand/40 bg-brand/15 text-brand shadow-sm"
                  : "border-border/80 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {CHANNEL_GROUP_LABELS[group]}
            </button>
          ))}
        </motion.div>
      ) : null}

      <div
        className={cn(
          "grid gap-6",
          sidebar && "lg:grid-cols-[minmax(0,1fr)_minmax(0,15.5rem)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,15.5rem)]",
        )}
      >
        {canManage ? (
          <aside className="hidden xl:block">
            <nav className="glass-panel sticky top-4 space-y-1 p-2" aria-label="Room sections">
              {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
                        active
                          ? "bg-brand/15 text-brand shadow-sm"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active && "text-brand")} aria-hidden />
                      {item.label}
                    </button>
                  );
                })}
            </nav>
          </aside>
        ) : null}

        <div className="min-w-0 space-y-4">
          {canManage ? (
            <div className="overflow-x-auto pb-0.5 xl:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <motion.div
                className="inline-flex min-w-full gap-1 rounded-xl border border-border/80 bg-muted/20 p-1"
                layout
              >
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          active ? "bg-brand text-foreground shadow-md" : "text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        <Icon className="h-4 w-4 opacity-90" aria-hidden />
                        <span className="hidden sm:inline">{item.label}</span>
                        <span className="sm:hidden">{item.shortLabel}</span>
                      </button>
                    );
                  })}
              </motion.div>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {sidebar ? <aside className="hidden lg:block">{sidebar}</aside> : null}
      </div>

      {mobileBar}
    </div>
  );
}
