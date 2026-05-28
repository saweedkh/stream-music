"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { ROOM_REACTION_EMOJIS } from "@/features/channels/components/room-reaction-constants";
import { useRoomReactions } from "@/features/channels/components/room-reaction-context";
import { cn } from "@/lib/utils";

type Props = {
  onReact: (emoji: string) => void;
  className?: string;
};

export function ListenerSidebarReactions({ onReact, className }: Props) {
  const { t } = useTranslations();
  const { bursts, isLive, sendLocalReaction } = useRoomReactions();
  const [pressedEmoji, setPressedEmoji] = useState<string | null>(null);

  function handleReact(emoji: string) {
    setPressedEmoji(emoji);
    window.setTimeout(() => setPressedEmoji((current) => (current === emoji ? null : current)), 180);
    sendLocalReaction(emoji);
    onReact(emoji);
  }

  return (
    <section className={cn("px-1", className)} aria-labelledby="listener-reactions-heading">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand/80" aria-hidden />
        <h2
          id="listener-reactions-heading"
          className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90"
        >
          {t("room.listener.section.reactions")}
        </h2>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-brand">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            {t("room.listener.reactionsLive")}
          </span>
        ) : null}
      </div>

      <div
        role="group"
        aria-label={t("room.listener.reactionsPickerLabel")}
        className="grid grid-cols-3 gap-1 px-1"
      >
        {ROOM_REACTION_EMOJIS.map((emoji) => {
          const isPressed = pressedEmoji === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReact(emoji)}
              className={cn(
                "relative flex aspect-[4/3] max-h-12 items-center justify-center rounded-xl text-[1.4rem] leading-none",
                "transition-[transform,background-color,box-shadow] duration-150 ease-out",
                "hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
                "active:scale-[0.92] motion-reduce:active:scale-100",
                isPressed ? "scale-[0.92] bg-brand/12 shadow-inner shadow-brand/10" : "bg-muted/20",
              )}
              aria-label={t("room.listener.reactWith", { emoji })}
            >
              <span
                className={cn(
                  "pointer-events-none select-none transition-transform duration-150",
                  isPressed && "scale-110",
                )}
                aria-hidden
              >
                {emoji}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-2 overflow-hidden rounded-xl px-2 transition-[max-height,opacity,margin] duration-300 ease-out",
          isLive ? "max-h-12 opacity-100" : "max-h-0 opacity-0",
        )}
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="flex min-h-9 items-center gap-1.5 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {bursts.map((burst) => (
              <span
                key={burst.id}
                className="shrink-0 animate-in fade-in duration-500 motion-reduce:animate-none text-lg leading-none"
              >
                {burst.emoji}
              </span>
            ))}
          </div>
          <p className="max-w-[7.5rem] shrink-0 truncate text-end text-[10px] leading-snug text-muted-foreground/80">
            {t("room.listener.reactionsHint")}
          </p>
        </div>
      </div>
    </section>
  );
}
