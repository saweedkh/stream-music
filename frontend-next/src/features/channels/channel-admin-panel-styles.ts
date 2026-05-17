import { cn } from "@/lib/utils";

export const adminSegmentBtn = (active: boolean) =>
  cn(
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
    active ? "bg-brand/12 text-brand" : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
  );

export const adminSectionLabel =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
