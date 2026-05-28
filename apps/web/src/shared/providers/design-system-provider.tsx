"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function DesignSystemProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={280} skipDelayDuration={80}>
        {children}
      </TooltipProvider>
    </MotionConfig>
  );
}
