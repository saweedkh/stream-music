"use client";

import { cn } from "@/lib/utils";

export function AuthPanelLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex items-center gap-1" aria-hidden>
        <span
          className="block w-[5px] rounded-full bg-gradient-to-b from-emerald-400 to-brand"
          style={{ height: 18 }}
        />
        <span
          className="block w-[5px] rounded-full bg-gradient-to-b from-emerald-400 to-brand shadow-[0_0_14px_rgba(34,197,94,0.6)]"
          style={{ height: 28 }}
        />
        <span
          className="block w-[5px] rounded-full bg-gradient-to-b from-emerald-400 to-brand"
          style={{ height: 21 }}
        />
        <span
          className="block w-[5px] rounded-full bg-gradient-to-b from-emerald-400 to-brand"
          style={{ height: 13 }}
        />
      </div>
      <p className="font-display text-xl font-bold leading-none tracking-tight text-slate-900 dark:text-white">
        <span>Beat</span> <span className="text-emerald-500 dark:text-emerald-400">Room</span>
      </p>
    </div>
  );
}
