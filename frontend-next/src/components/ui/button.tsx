"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-emerald-500/40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98]",
        secondary:
          "border border-zinc-700/90 bg-zinc-900/80 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800 active:scale-[0.98]",
        ghost: "border border-transparent text-zinc-300 hover:border-zinc-700/80 hover:bg-zinc-900/70 hover:text-white",
        danger:
          "border border-red-500/40 bg-red-600 text-white shadow-sm hover:bg-red-500 active:scale-[0.98]",
        destructive:
          "border border-red-500/40 bg-red-600 text-white shadow-sm hover:bg-red-500 active:scale-[0.98]",
        outline: "border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-900/80",
        link: "border-transparent text-emerald-400 underline-offset-4 hover:underline",
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
