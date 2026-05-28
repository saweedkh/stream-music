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
        "flex h-10 w-full rounded-lg border border-border/90 bg-card/80 px-3 py-2 text-sm text-foreground shadow-inner transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        ariaInvalid && "border-red-500/70 focus-visible:ring-red-500/50",
        !ariaInvalid && valid && "border-brand/50 focus-visible:ring-brand/40",
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
