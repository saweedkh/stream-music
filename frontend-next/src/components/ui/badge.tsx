import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning";

const variantClass: Record<Variant, string> = {
  default: "border-slate-700 bg-slate-800 text-slate-200",
  success: "border-emerald-700 bg-emerald-950 text-emerald-300",
  warning: "border-amber-700 bg-amber-950 text-amber-300",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", variantClass[variant], className)}
      {...props}
    />
  );
}
