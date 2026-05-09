import { Suspense } from "react";
import { JoinLandingClient } from "@/features/channels/join-landing-client";

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-6 text-center shadow-lg shadow-black/30">
      <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
        <JoinLandingClient />
      </Suspense>
    </div>
  );
}
