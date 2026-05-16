import Link from "next/link";
import { getPartyRecap } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ channelId: string }> };

export default async function PartyRecapPage({ params }: Props) {
  const { channelId } = await params;
  let recap: Awaited<ReturnType<typeof getPartyRecap>> | null = null;
  try {
    recap = await getPartyRecap(channelId);
  } catch {
    recap = null;
  }

  if (!recap) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Party recap unavailable</h1>
        <p className="text-sm text-zinc-400">This room may be private or has no playback history yet.</p>
        <Link href="/" className="text-emerald-400 hover:underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500/90">Party recap</p>
        <h1 className="text-3xl font-bold text-white">{recap.channel_name}</h1>
        {recap.description ? <p className="text-sm text-zinc-400">{recap.description}</p> : null}
      </header>

      <Card className="border-zinc-800/90 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="text-lg">Top tracks</CardTitle>
        </CardHeader>
        <CardContent>
          {recap.top_tracks.length === 0 ? (
            <p className="text-sm text-zinc-500">No plays recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {recap.top_tracks.map((t, i) => (
                <li key={t.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-mono text-zinc-500">{i + 1}.</span>
                  <span className="font-medium text-zinc-100">{t.title}</span>
                  {t.artist ? <span className="text-zinc-500">— {t.artist}</span> : null}
                  <span className="ml-auto text-xs text-emerald-400/90">×{t.play_count}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-zinc-500">
        <Link href={`/channel/${channelId}`} className="text-emerald-400 hover:underline">
          Join the room
        </Link>
      </p>
    </div>
  );
}
