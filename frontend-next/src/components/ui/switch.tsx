"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentPropsWithoutRef<"button">, "onClick"> & {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

const Switch = React.forwardRef<HTMLButtonElement, Props>(({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onCheckedChange(!checked)}
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      checked ? "bg-brand" : "bg-muted",
      disabled && "cursor-not-allowed opacity-50",
      className,
    )}
    {...props}
  >
    <span
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
        checked ? "translate-x-[1.25rem]" : "translate-x-0.5",
      )}
    />
  </button>
));
Switch.displayName = "Switch";

export { Switch };
