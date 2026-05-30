import { Suspense } from "react";
import { JoinLandingClient } from "@/features/channels";

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/80 bg-background/55 p-6 text-center shadow-lg shadow-black/30">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <JoinLandingClient />
      </Suspense>
    </div>
  );
}
