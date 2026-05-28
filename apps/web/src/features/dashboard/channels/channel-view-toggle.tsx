"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

export type ChannelViewMode = "list" | "grid";

type Props = {
  mode: ChannelViewMode;
  onModeChange: (mode: ChannelViewMode) => void;
  className?: string;
};

export function ChannelViewToggle({ mode, onModeChange, className }: Props) {
  const { t } = useTranslations();

  return (
    <div
      role="group"
      aria-label={t("channels.viewLayout")}
      className={cn(
        "flex shrink-0 items-center rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-list)] p-0.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-8 rounded-md", mode === "list" && "bg-background shadow-sm")}
        onClick={() => onModeChange("list")}
        aria-pressed={mode === "list"}
        aria-label={t("channels.viewList")}
        title={t("channels.viewList")}
      >
        <List className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-8 rounded-md", mode === "grid" && "bg-background shadow-sm")}
        onClick={() => onModeChange("grid")}
        aria-pressed={mode === "grid"}
        aria-label={t("channels.viewGrid")}
        title={t("channels.viewGrid")}
      >
        <LayoutGrid className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
