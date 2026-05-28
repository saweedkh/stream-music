"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast-provider";
import type { PartyRecap } from "@/lib/api";
import { PartyRecapHeatmap } from "@/features/party/components/party-recap-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function PartyRecapClient({ recap, channelId }: { recap: PartyRecap; channelId: string }) {
  const { showToast } = useToast();
  const heatmap = recap.excitement_heatmap?.buckets ?? [];

  async function shareRecap() {
    const url = typeof window !== "undefined" ? window.location.href : `/party/${channelId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: recap.channel_name, text: "Party recap", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Recap link copied.", "success");
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand/90">Party recap</p>
        <h1 className="text-3xl font-bold text-foreground">{recap.channel_name}</h1>
        {recap.description ? <p className="text-sm text-muted-foreground">{recap.description}</p> : null}
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void shareRecap()}>
          <Share2 className="h-4 w-4" />
          Share recap
        </Button>
      </header>

      {heatmap.length > 0 ? (
        <Card className="border-border/90 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Listener energy</CardTitle>
          </CardHeader>
          <CardContent>
            <PartyRecapHeatmap buckets={heatmap} />
            {recap.listener_peaks && recap.listener_peaks.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Peak moments when chat reactions, track reactions, and skips clustered together.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/90 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Top tracks</CardTitle>
        </CardHeader>
        <CardContent>
          {recap.top_tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plays recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {recap.top_tracks.map((t, i) => (
                <li key={t.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">{i + 1}.</span>
                  <span className="font-medium text-foreground">{t.title}</span>
                  {t.artist ? <span className="text-muted-foreground">— {t.artist}</span> : null}
                  <span className="ml-auto text-xs text-brand/90">×{t.play_count}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link href={`/channel/${channelId}`} className="text-brand hover:underline">
          Join the room
        </Link>
      </p>
    </div>
  );
}
