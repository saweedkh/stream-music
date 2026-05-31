"use client";

import { Skeleton } from "@/shared/ui/skeleton";

export function ProfileLoadingState() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Skeleton className="h-28 rounded-xl sm:h-32" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
