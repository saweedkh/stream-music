import { Suspense } from "react";
import { JoinPrivateInviteClient } from "@/features/channels";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function JoinPrivateInvitePage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/80 bg-background/55 p-6 text-center shadow-lg shadow-black/30">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <JoinPrivateInviteClient token={decodeURIComponent(token)} />
      </Suspense>
    </div>
  );
}
