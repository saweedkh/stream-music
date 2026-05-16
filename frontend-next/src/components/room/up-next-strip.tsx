"use client";

import { ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";

export type UpNextItem = {
  id: number;
  title: string;
  artist?: string;
};

type Props = {
  items: UpNextItem[];
  className?: string;
};

export function UpNextStrip({ items, className }: Props) {
  if (!items.length) return null;
  return (
    <div className={cn("rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <ListMusic className="size-3.5" aria-hidden />
        Up next
      </p>
      <ul className="space-y-1.5">
        {items.slice(0, 3).map((item, i) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800/80 font-mono text-[10px] text-zinc-400">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-zinc-200">{item.title}</span>
            {item.artist ? <span className="hidden max-w-[30%] truncate text-xs text-zinc-500 sm:inline">{item.artist}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
