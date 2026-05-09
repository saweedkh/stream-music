"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group border border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-lg shadow-black/40 backdrop-blur-md",
          title: "text-sm font-medium",
          description: "text-xs text-zinc-400",
          success: "!border-emerald-800/50 !bg-emerald-950/90",
          error: "!border-red-900/50 !bg-red-950/90",
          info: "!border-zinc-700 !bg-zinc-900/95",
        },
      }}
      {...props}
    />
  );
}
