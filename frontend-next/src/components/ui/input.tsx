import * as React from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  valid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, valid = false, "aria-invalid": ariaInvalid, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-700/90 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 shadow-inner transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-50",
        ariaInvalid && "border-red-500/70 focus-visible:ring-red-500/50",
        !ariaInvalid && valid && "border-emerald-600/50 focus-visible:ring-emerald-500/40",
        className,
      )}
      ref={ref}
      aria-invalid={ariaInvalid}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
