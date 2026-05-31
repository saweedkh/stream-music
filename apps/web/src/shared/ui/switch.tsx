"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Compact iOS-style switch; thumb uses logical `start` so RTL matches LTR. */
const TRACK = "relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5";
const THUMB =
  "pointer-events-none absolute top-0.5 block size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-[inset-inline-start] duration-200 ease-out";

export type SwitchProps = Omit<React.ComponentPropsWithoutRef<"button">, "onClick"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        TRACK,
        "cursor-pointer border-0 transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-brand" : "bg-muted-foreground/25 dark:bg-muted-foreground/35",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    >
      <span
        className={cn(THUMB, checked ? "start-[calc(100%-1.375rem)]" : "start-0.5")}
        aria-hidden
      />
    </button>
  ),
);
Switch.displayName = "Switch";

export { Switch };
