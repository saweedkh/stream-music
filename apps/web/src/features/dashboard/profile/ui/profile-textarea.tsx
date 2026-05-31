"use client";

import * as React from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ProfileTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const ProfileTextarea = React.forwardRef<HTMLTextAreaElement, ProfileTextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[6.5rem] w-full resize-y rounded-lg border border-border/90 bg-card/80 px-3 py-2.5 text-start text-sm text-foreground shadow-inner transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
ProfileTextarea.displayName = "ProfileTextarea";
