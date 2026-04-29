import { Badge } from "@/components/ui/badge";
import { HomeActions } from "@/features/channels/home-actions";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <Badge variant="success">Realtime LAN Sync</Badge>
        <h1 className="mt-3 text-3xl font-bold">Synchronized channel playback for teams and parties</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Launch or join channels, apply low-drift playback controls, and monitor sync health with a cleaner, faster workflow.
        </p>
      </section>
      <HomeActions />
    </div>
  );
}
