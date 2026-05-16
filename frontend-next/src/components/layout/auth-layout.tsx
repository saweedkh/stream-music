import type { ReactNode } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthLayout({ title, description, children }: Props) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-1 py-8">
      <Link href="/" className="mb-8 flex items-center gap-3 transition-opacity hover:opacity-90">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
          <Radio className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">Stream Music</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">LAN parties &amp; shared listening</span>
        </span>
      </Link>
      <div className="rounded-2xl border border-zinc-800/90 bg-card/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
