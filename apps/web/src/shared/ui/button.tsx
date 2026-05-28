"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-brand/35 bg-brand text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-strong active:scale-[0.98]",
        secondary:
          "border border-border bg-card/80 text-foreground hover:border-muted hover:bg-muted/40 active:scale-[0.98]",
        ghost: "border border-transparent text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
        danger: "border border-destructive/40 bg-destructive text-brand-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
        destructive: "border border-destructive/40 bg-destructive text-brand-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted/25",
        link: "border-transparent text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
