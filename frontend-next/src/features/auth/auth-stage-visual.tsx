"use client";

import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT_BARS = [12, 20, 28, 22, 16, 26, 18, 30, 34, 24, 20, 14];
const RIGHT_BARS = [14, 18, 26, 32, 20, 28, 22, 30, 26, 18, 22, 16];

function EqBars({ heights, className, compact }: { heights: number[]; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-end justify-center gap-[3px]", compact ? "h-[52px] gap-[2px]" : "h-[80px] gap-[4px]", className)}>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className={cn(
            "auth-eq-bar rounded-full bg-gradient-to-t from-brand/50 to-brand",
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
        "auth-hero-visual relative mx-auto w-full",
        compact ? "auth-hero-visual--compact max-w-[188px]" : "max-w-[320px]",
        className,
      )}
    >
      <div className="auth-hero-ring auth-hero-ring--1" aria-hidden />
      <div className="auth-hero-ring auth-hero-ring--2" aria-hidden />
      <div className="auth-hero-ring auth-hero-ring--3" aria-hidden />
      <div className="auth-hero-ring auth-hero-ring--4" aria-hidden />

      <div className={cn("relative flex items-center justify-center px-2", compact ? "gap-2" : "gap-3")}>
        <EqBars heights={LEFT_BARS} compact={compact} />
        <div
          className={cn(
            "auth-hero-core relative z-[2] flex shrink-0 items-center justify-center rounded-full",
            compact ? "h-[64px] w-[64px]" : "h-[96px] w-[96px]",
          )}
        >
          <Radio
            className={cn("relative z-[1] text-brand", compact ? "h-7 w-7" : "h-11 w-11")}
            strokeWidth={1.5}
            aria-hidden
          />
          <span className="auth-hero-core-pulse absolute inset-0 rounded-full" aria-hidden />
        </div>
        <EqBars heights={RIGHT_BARS} compact={compact} />
      </div>
    </div>
  );
}
