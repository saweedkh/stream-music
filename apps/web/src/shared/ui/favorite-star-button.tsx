"use client";

import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type FavoriteStarButtonProps = {
  favorited: boolean;
  busy?: boolean;
  onToggle: () => void;
  className?: string;
  label: string;
};

export function FavoriteStarButton({ favorited, busy, onToggle, className, label }: FavoriteStarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={favorited}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
        "disabled:opacity-50",
        favorited
          ? "border-amber-500/40 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
          : "border-border/60 bg-muted/20 text-muted-foreground hover:border-amber-500/30 hover:text-amber-500",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Star className={cn("h-4 w-4", favorited && "fill-current")} aria-hidden />
      )}
    </button>
  );
}
