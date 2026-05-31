/** Subtle cover accent from a label — shared by playlists, track sharing, etc. */
const ACCENTS = [
  { cover: "from-brand/25 via-brand/10 to-transparent", icon: "text-brand", ring: "ring-brand/25" },
  { cover: "from-violet-500/25 via-violet-500/10 to-transparent", icon: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/25" },
  { cover: "from-sky-500/25 via-sky-500/10 to-transparent", icon: "text-sky-600 dark:text-sky-400", ring: "ring-sky-500/25" },
  { cover: "from-amber-500/20 via-amber-500/8 to-transparent", icon: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/25" },
] as const;

function hash(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i += 1) {
    h = (h << 5) - h + label.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function contentAccent(label: string) {
  return ACCENTS[hash(label) % ACCENTS.length];
}
