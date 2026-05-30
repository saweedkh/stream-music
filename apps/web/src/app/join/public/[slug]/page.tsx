import { Suspense } from "react";
import { JoinPublicClient } from "@/features/channels";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function JoinPublicPage({ params }: Props) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/80 bg-background/55 p-6 text-center shadow-lg shadow-black/30">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <JoinPublicClient slug={decodeURIComponent(slug)} />
      </Suspense>
    </div>
  );
}
