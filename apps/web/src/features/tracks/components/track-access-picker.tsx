"use client";

import { Globe, Lock } from "lucide-react";
import {
  TRACK_ACCESS_HINT_KEYS,
  TRACK_ACCESS_LABEL_KEYS,
  type TrackAccess,
} from "@/features/tracks/model/track-access";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

type TrackAccessPickerProps = {
  access: TrackAccess;
  onAccessChange: (access: TrackAccess) => void;
  compact?: boolean;
};

export function TrackAccessPicker({ access, onAccessChange, compact }: TrackAccessPickerProps) {
  const { t } = useTranslations();
  const options: TrackAccess[] = ["public", "private"];

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{t("tracks.accessLabel")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = access === opt;
          const Icon = opt === "public" ? Globe : Lock;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onAccessChange(opt)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border text-start transition-all",
                compact ? "px-2.5 py-2.5" : "px-3 py-3",
                active
                  ? "border-brand/50 bg-brand/10 shadow-sm ring-1 ring-brand/20"
                  : "border-border/60 bg-background/50 hover:border-border hover:bg-muted/30",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold", active ? "text-brand" : "text-foreground")}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(TRACK_ACCESS_LABEL_KEYS[opt])}
              </span>
              {!compact ? (
                <span className="text-[11px] leading-snug text-muted-foreground">{t(TRACK_ACCESS_HINT_KEYS[opt])}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
