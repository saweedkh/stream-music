"use client";

import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT_BARS = [12, 20, 28, 22, 16, 26, 18, 30, 34, 24, 20, 14];
const RIGHT_BARS = [14, 18, 26, 32, 20, 28, 22, 30, 26, 18, 22, 16];

function EqBars({ heights, className }: { heights: number[]; className?: string }) {
  return (
    <div className={cn("flex h-[80px] items-end justify-center gap-[4px]", className)}>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="auth-eq-bar w-[4px] rounded-full bg-gradient-to-t from-brand/50 to-brand"
          style={{ height: h }}
          animate={{ scaleY: [1, 1.4, 0.75, 1.1, 1] }}
          transition={{ duration: 1.4 + (i % 5) * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.04 }}
        />
      ))}
    </div>
  );
}

export function AuthStageVisual({ className }: { className?: string }) {
  return (
    <div className={cn("auth-hero-visual relative mx-auto w-full max-w-[340px]", className)}>
      <div className="auth-hero-ring auth-hero-ring--1" aria-hidden />
      <div className="auth-hero-ring auth-hero-ring--2" aria-hidden />
      <div className="auth-hero-ring auth-hero-ring--3" aria-hidden />
      <div className="auth-hero-ring auth-hero-ring--4" aria-hidden />

      <div className="relative flex items-center justify-center gap-3 px-2">
        <EqBars heights={LEFT_BARS} />
        <div className="auth-hero-core relative z-[2] flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-full">
          <Radio className="relative z-[1] h-11 w-11 text-brand" strokeWidth={1.5} aria-hidden />
          <span className="auth-hero-core-pulse absolute inset-0 rounded-full" aria-hidden />
        </div>
        <EqBars heights={RIGHT_BARS} />
      </div>
    </div>
  );
}
