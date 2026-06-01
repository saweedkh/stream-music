import { cn } from "@/lib/utils";

function BrandWordmark({ nativeName }: { nativeName?: string }) {
  const [faBeat, faRoom] = nativeName?.trim().split(/\s+/, 2) ?? [];

  return (
    <div className="relative select-none">
      {/* English — only in-flow child; parent flex centers this on the header midline */}
      <p className="font-display text-[clamp(1.375rem,4.5vw,1.875rem)] font-extrabold leading-none tracking-[-0.03em] text-foreground">
        Beat{" "}
        <span className="bg-gradient-to-br from-brand via-brand-muted to-emerald-400 bg-clip-text text-transparent">
          Room
        </span>
      </p>

      {faBeat && faRoom ? (
        <div className="absolute left-1/2 top-full -translate-x-1/2 pt-0.5">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden
              className="h-px w-4 bg-gradient-to-r from-transparent to-brand/25 sm:w-5"
            />
            <p className="text-[13px] font-medium leading-none sm:text-[13px]" lang="fa" dir="rtl">
              <span className="text-foreground/85">{faBeat}</span>{" "}
              <span className="bg-gradient-to-br from-brand via-brand-muted to-emerald-400 bg-clip-text text-transparent opacity-85">
                {faRoom}
              </span>
            </p>
            <span
              aria-hidden
              className="h-px w-4 bg-gradient-to-l from-transparent to-brand/25 sm:w-5"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Shared Beat Room mark for landing header/footer. */
export function LandingBrand({
  tagline,
  nativeName,
  compact,
  showIcon = true,
  emphasis,
}: {
  tagline?: string;
  /** Persian / local name shown under the wordmark (navbar) */
  nativeName?: string;
  compact?: boolean;
  showIcon?: boolean;
  /** Large wordmark for centered navbar */
  emphasis?: boolean;
}) {
  if (emphasis) {
    return <BrandWordmark nativeName={nativeName} />;
  }

  const textBlock = (
    <div>
      <p
        className={cn(
          "font-display font-bold tracking-tight text-foreground",
          compact ? "text-[14px]" : "text-[15px]",
        )}
      >
        Beat <span className="text-brand">Room</span>
      </p>
      {tagline ? (
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
          {tagline}
        </p>
      ) : null}
    </div>
  );

  if (!showIcon) {
    return textBlock;
  }

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-strong shadow-[0_4px_16px_-4px_var(--brand)] ring-1 ring-white/20",
          compact ? "h-8 w-8" : "h-9 w-9",
        )}
      >
        <div className="flex items-end justify-center gap-[2px]" aria-hidden>
          {[14, 22, 17, 11].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-white/90"
              style={{ height: h * (compact ? 0.38 : 0.45) }}
            />
          ))}
        </div>
      </div>
      <div className={tagline ? "hidden leading-none sm:block" : undefined}>{textBlock}</div>
    </div>
  );
}
