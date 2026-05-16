"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageSquare, Music, Shield, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/lib/notifications/store";
import type { AppNotification, NotificationCategory } from "@/lib/notifications/types";

const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; icon: typeof MessageSquare; className: string }
> = {
  chat: { label: "Chat", icon: MessageSquare, className: "text-sky-400 bg-sky-500/15" },
  playback: { label: "Playback", icon: Music, className: "text-emerald-400 bg-emerald-500/15" },
  moderation: { label: "Moderation", icon: Shield, className: "text-amber-400 bg-amber-500/15" },
  system: { label: "System", icon: Bell, className: "text-slate-300 bg-slate-500/15" },
};

const CATEGORY_ORDER: NotificationCategory[] = ["chat", "playback", "moderation", "system"];

function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function NotificationRow({ item, onOpen }: { item: AppNotification; onOpen: (item: AppNotification) => void }) {
  const meta = CATEGORY_META[item.category];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        item.read
          ? "border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/50"
          : "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10",
      )}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.className)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{item.title}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{meta.label}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-xs text-slate-400">{item.body}</span>
        <span className="mt-1 block text-[10px] text-slate-500">{formatWhen(item.createdAt)}</span>
      </span>
    </button>
  );
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function openItem(item: AppNotification) {
    markRead(item.id);
    setOpen(false);
    router.push(item.href);
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="ghost"
        className="relative h-9 w-9 px-0"
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-slate-950">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-100">Notifications</span>
            <div className="flex items-center gap-1">
              {items.length > 0 ? (
                <>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => markAllRead()} title="Mark all read">
                    <CheckCheck className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => clear()} title="Clear all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="ghost" className="h-8 w-8 px-0" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="max-h-[min(70vh,24rem)] overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500">No notifications yet. Chat and track changes appear here while you browse.</p>
            ) : (
              CATEGORY_ORDER.map((cat) => {
                const list = grouped.get(cat) ?? [];
                if (list.length === 0) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <section key={cat} className="mb-3 last:mb-0">
                    <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{meta.label}</h3>
                    <ul className="space-y-1.5">
                      {list.map((item) => (
                        <li key={item.id}>
                          <NotificationRow item={item} onOpen={openItem} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-800 px-3 py-2 text-center">
            <Link href="/dashboard" className="text-xs text-slate-400 hover:text-emerald-300" onClick={() => setOpen(false)}>
              Push settings on dashboard
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
