import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md border border-zinc-800/70 bg-gradient-to-r from-zinc-900/75 via-zinc-800/55 to-zinc-900/75",
        className,
      )}
    />
  );
}
