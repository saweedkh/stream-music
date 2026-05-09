import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 text-sm [&_p]:leading-relaxed", {
  variants: {
    variant: {
      default: "border-zinc-700 bg-zinc-900/70 text-zinc-200",
      info: "border-sky-800/60 bg-sky-950/40 text-sky-100",
      error: "border-red-900/70 bg-red-950/45 text-red-100",
      success: "border-emerald-800/60 bg-emerald-950/40 text-emerald-100",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type Tone = "info" | "error" | "success";

const toneToVariant: Record<Tone, NonNullable<VariantProps<typeof alertVariants>["variant"]>> = {
  info: "info",
  error: "error",
  success: "success",
};

export function Alert({
  className,
  variant,
  tone = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: VariantProps<typeof alertVariants>["variant"]; tone?: Tone }) {
  const v = variant ?? toneToVariant[tone];
  return <div role="alert" className={cn(alertVariants({ variant: v }), className)} {...props} />;
}

export { alertVariants };
