import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-border/80 bg-card/90 text-foreground",
        secondary: "border-border bg-muted/80 text-foreground/80",
        success: "border-brand/40 bg-[var(--brand-subtle)] text-brand",
        warning: "border-warning/40 bg-[var(--warning-subtle)] text-warning",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
        outline: "border-border text-foreground/80",
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
