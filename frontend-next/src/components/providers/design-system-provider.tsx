"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function DesignSystemProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      {children}
    </TooltipProvider>
  );
}
