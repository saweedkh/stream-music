"use client";

const TRACKS = [
  { title: "Midnight City", artist: "M83", active: true },
  { title: "Blinding Lights", artist: "The Weeknd", active: false },
  { title: "Levitating", artist: "Dua Lipa", active: false },
];

const LISTENERS = ["A", "B", "C", "D"];

function EqBars({ className }: { className?: string }) {
  return (
    <div className={`channel-eq-bars ${className ?? ""}`} aria-hidden>
      <span style={{ animationDelay: "0ms" }} />
      <span style={{ animationDelay: "150ms" }} />
      <span style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function RoomMockup() {
  return (
    <div className="glass-panel-elevated relative overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 100%, var(--glow-brand), transparent 70%)",
        }}
      />

      {/* Titlebar */}
      <div className="relative flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <span className="status-online inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
          <span className="status-live h-1.5 w-1.5" />
          Live Room
        </span>
        <div className="w-12" />
      </div>

      {/* Room name + now playing */}
      <div className="relative px-5 pb-3 pt-4">
        <p className="font-display text-[15px] font-semibold text-foreground">
          Late Night Vibes 🌙
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <EqBars className="text-brand" />
          <span className="text-[12px] text-muted-foreground">
            در حال پخش • Midnight City
          </span>
        </div>
      </div>

      {/* Queue */}
      <div className="relative space-y-0.5 px-3 pb-3">
        {TRACKS.map((track, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              track.active
                ? "bg-brand-subtle ring-1 ring-brand/15"
                : "hover:bg-muted/20"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                track.active
                  ? "bg-brand text-brand-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {track.active ? <EqBars className="text-white" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-[13px] font-medium ${
                  track.active ? "text-brand" : "text-foreground"
                }`}
              >
                {track.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {track.artist}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Listeners */}
      <div className="relative border-t border-border/40 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {LISTENERS.map((l, i) => (
              <div
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-brand text-[9px] font-bold text-brand-foreground"
                style={{ zIndex: LISTENERS.length - i }}
              >
                {l}
              </div>
            ))}
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] text-muted-foreground">
              +4
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">۸ شنونده</span>
        </div>
      </div>

      {/* Chat */}
      <div className="relative border-t border-border/40 px-4 pb-4 pt-3">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
              S
            </div>
            <div className="surface-inset rounded-xl rounded-tl-none px-3 py-1.5 text-[12px] text-foreground">
              این آهنگ خیلی خوبه! 🎵
            </div>
          </div>
          <div className="flex justify-end">
            <div className="rounded-xl rounded-tr-none bg-brand px-3 py-1.5 text-[12px] font-medium text-brand-foreground">
              +1 موافقم 🔥
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
