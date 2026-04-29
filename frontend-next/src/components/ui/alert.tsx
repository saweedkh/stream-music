import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "error" | "success";

const toneClass: Record<Tone, string> = {
  info: "border-blue-800 bg-blue-950/40 text-blue-200",
  error: "border-rose-800 bg-rose-950/40 text-rose-200",
  success: "border-emerald-800 bg-emerald-950/40 text-emerald-200",
};

export function Alert({
  className,
  tone = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cn("rounded-md border px-3 py-2 text-sm", toneClass[tone], className)} {...props} />;
}
