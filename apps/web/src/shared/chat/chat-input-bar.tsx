"use client";

import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";

export type ChatInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder: string;
  sendLabel: string;
  maxLength?: number;
  inputRef?: RefObject<HTMLInputElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputTestId?: string;
  topSlot?: ReactNode;
  leading?: ReactNode;
  overlay?: ReactNode;
  hint?: string;
  closedBanner?: ReactNode;
  fullHeight?: boolean;
  className?: string;
  /** Allow send without text (e.g. attachment-only). */
  allowEmptySend?: boolean;
};

/** Channel-style composer: Input + Send button row. */
export function ChatInputBar({
  value,
  onChange,
  onSend,
  sending = false,
  disabled = false,
  placeholder,
  sendLabel,
  maxLength,
  inputRef,
  onKeyDown,
  inputTestId,
  topSlot,
  leading,
  overlay,
  hint,
  closedBanner,
  fullHeight = true,
  className,
  allowEmptySend = false,
}: ChatInputBarProps) {
  const canSend = (Boolean(value.trim()) || allowEmptySend) && !sending && !disabled;

  if (closedBanner) {
    return <div className={cn("shrink-0", className)}>{closedBanner}</div>;
  }

  return (
    <div className={cn("shrink-0", className)}>
      {topSlot}
      <div
        className={cn(
          "relative flex gap-2",
          fullHeight && "mt-auto shrink-0 border-t border-border/40 bg-[var(--surface-inset)] px-0.5 pt-3",
        )}
      >
        {overlay}
        {leading}
        <Input
          ref={inputRef}
          data-testid={inputTestId}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="border border-border bg-card/80 text-sm"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          type="button"
          className="shrink-0 gap-1.5 bg-brand hover:bg-brand"
          disabled={!canSend}
          onClick={onSend}
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {sendLabel}
        </Button>
      </div>
      {hint ? <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
