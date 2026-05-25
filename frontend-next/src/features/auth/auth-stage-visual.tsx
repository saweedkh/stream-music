"use client";

import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT_BARS = [12, 20, 28, 22, 16, 26, 18, 30, 34, 24, 20, 14];
const RIGHT_BARS = [14, 18, 26, 32, 20, 28, 22, 30, 26, 18, 22, 16];

function EqBars({ heights, className, compact }: { heights: number[]; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-end justify-center", compact ? "h-[52px] gap-[2px]" : "h-[80px] gap-1", className)}>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className={cn(
            "origin-bottom rounded-full bg-gradient-to-t from-emerald-600/60 to-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.25)] dark:from-brand/50 dark:to-brand dark:shadow-[0_0_8px_rgba(34,197,94,0.3)]",
            compact ? "w-[3px]" : "w-[4px]",
          )}
          style={{ height: h }}
          animate={{ scaleY: [1, 1.4, 0.75, 1.1, 1] }}
          transition={{ duration: 1.4 + (i % 5) * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.04 }}
        />
      ))}
    </div>
  );
}

type AuthStageVisualProps = {
  className?: string;
  size?: "default" | "compact";
};

export function AuthStageVisual({ className, size = "default" }: AuthStageVisualProps) {
  const compact = size === "compact";

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full items-center justify-center",
        compact ? "min-h-[88px] max-w-[188px] py-0.5" : "min-h-[160px] max-w-[320px]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.08] blur-[50px] dark:bg-emerald-500/[0.1]"
        style={{ width: "60%", height: "60%" }}
        aria-hidden
      />

      <div className={cn("relative flex items-center justify-center px-2", compact ? "gap-2" : "gap-3")}>
        <EqBars heights={LEFT_BARS} compact={compact} />
        <div
          className={cn(
            "relative z-[2] flex shrink-0 items-center justify-center",
            compact ? "h-16 w-16" : "h-24 w-24",
          )}
        >
          <Radio
            className={cn("relative z-[1] text-emerald-500 dark:text-brand", compact ? "h-7 w-7" : "h-11 w-11")}
            strokeWidth={1.5}
            aria-hidden
          />
          <span
            className="absolute -inset-3 rounded-full blur-[16px]"
            style={{
              background: "radial-gradient(circle, rgba(16,185,129,0.18), transparent 70%)",
              animation: "auth-core-pulse 2.8s ease-in-out infinite",
            }}
            aria-hidden
          />
        </div>
        <EqBars heights={RIGHT_BARS} compact={compact} />
      </div>
    </div>
  );
}
