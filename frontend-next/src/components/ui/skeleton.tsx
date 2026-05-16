import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md border border-border/70 bg-gradient-to-r from-card/75 via-muted/55 to-card/75",
        className,
      )}
    />
  );
}
