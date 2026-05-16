"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto min-h-10 w-full max-w-full flex-wrap items-center justify-start gap-1 rounded-xl border border-border/80 bg-muted/25 p-1 text-muted-foreground backdrop-blur-sm sm:flex-nowrap",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-brand data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:shadow-brand/20",
      "data-[state=inactive]:hover:bg-muted/40 data-[state=inactive]:hover:text-foreground",
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-5 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none",
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
