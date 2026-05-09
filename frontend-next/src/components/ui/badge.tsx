import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-zinc-950",
  {
    variants: {
      variant: {
        default: "border-zinc-700/80 bg-zinc-900/90 text-zinc-200",
        secondary: "border-zinc-600 bg-zinc-800/80 text-zinc-300",
        success: "border-emerald-600/40 bg-emerald-950/60 text-emerald-300",
        warning: "border-amber-600/40 bg-amber-950/50 text-amber-200",
        destructive: "border-red-600/40 bg-red-950/50 text-red-200",
        outline: "border-zinc-600 text-zinc-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
