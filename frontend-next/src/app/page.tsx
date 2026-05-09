import { Badge } from "@/components/ui/badge";
import { HomeActions } from "@/features/channels/home-actions";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/85 via-slate-900 to-emerald-950/30 p-7 shadow-[0_24px_60px_-35px_rgba(16,185,129,0.55)]">
        <Badge variant="success">Realtime LAN Sync</Badge>
        <h1 className="mt-3 text-3xl font-bold">Synchronized channel playback for teams and parties</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Launch or join channels, apply low-drift playback controls, and manage everything with a Spotify-inspired polished interface.
        </p>
      </section>
      <HomeActions />
    </div>
  );
}
