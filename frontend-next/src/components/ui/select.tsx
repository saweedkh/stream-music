import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  "aria-invalid": ariaInvalid,
  valid = false,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { valid?: boolean }) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-indigo-500 focus:ring-2",
        ariaInvalid && "border-rose-500 ring-rose-500 focus:ring-rose-500",
        !ariaInvalid && valid && "border-emerald-500 ring-emerald-500 focus:ring-emerald-500",
        className,
      )}
      aria-invalid={ariaInvalid}
      {...props}
    />
  );
}
