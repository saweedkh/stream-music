/** Design tokens — single source for CSS variables and Tailwind. */

export const theme = {
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
  },
  colors: {
    background: "#07090f",
    foreground: "#f8fafc",
    card: "#111827",
    cardForeground: "#f8fafc",
    muted: "#94a3b8",
    mutedForeground: "#94a3b8",
    border: "#27272a",
    ring: "#34d399",
    brand: "#22c55e",
    brandStrong: "#16a34a",
  },
  typography: {
    meta: "text-xs",
    body: "text-sm",
    title: "text-lg font-semibold",
    display: "font-display text-2xl font-semibold tracking-tight sm:text-3xl",
  },
  spacing: {
    card: "p-5",
    cardCompact: "p-4",
  },
} as const;

export type AccentKey = "emerald" | "violet" | "rose" | "amber" | "sky";

export const accentLabelClass: Record<AccentKey, string> = {
  emerald: "text-brand-muted",
  violet: "text-violet-400/90",
  rose: "text-rose-400/90",
  amber: "text-amber-400/90",
  sky: "text-sky-400/90",
};
