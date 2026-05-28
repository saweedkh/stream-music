"use client";

import type { ComponentProps } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="top-right"
      richColors
      closeButton
      className="toaster group"
      style={{ fontFamily: "var(--font-inter)" }}
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-card/95 text-foreground shadow-lg shadow-black/20 backdrop-blur-md font-sans rtl:font-fa",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          success: "!border-brand/50 !bg-[var(--brand-subtle)]",
          error: "!border-destructive/50 !bg-destructive/10",
          info: "!border-border !bg-card/95",
        },
      }}
      {...props}
    />
  );
}
