"use client";

import { useTranslations } from "@/shared/providers/locale-provider";
import { WorkspaceToolbar } from "@/shared/layout/workspace";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Loader2 } from "lucide-react";
import type { ExploreFilters } from "@/features/discovery/hooks/use-explore-feed";
import { cn } from "@/lib/utils";

type ExploreFiltersBarProps = {
  filters: ExploreFilters;
  onChange: (next: ExploreFilters) => void;
  refreshing?: boolean;
};

export function ExploreFiltersBar({ filters, onChange, refreshing }: ExploreFiltersBarProps) {
  const { t } = useTranslations();

  return (
    <div className="surface-card sticky top-0 z-10 p-3.5 sm:p-4">
      <WorkspaceToolbar
        actions={
          <>
            {refreshing ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
            <Button
              type="button"
              size="sm"
              variant={filters.liveOnly ? "default" : "secondary"}
              className={cn(filters.liveOnly && "bg-brand text-brand-foreground hover:bg-brand-strong")}
              onClick={() => onChange({ ...filters, liveOnly: !filters.liveOnly })}
            >
              {t("explore.filterLiveOnly")}
            </Button>
          </>
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="sr-only" htmlFor="explore-filter-q">
              {t("explore.filterSearch")}
            </label>
            <Input
              id="explore-filter-q"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
              placeholder={t("explore.filterSearchPlaceholder")}
              className="h-10 bg-transparent"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="explore-filter-lang">
              {t("explore.filterLang")}
            </label>
            <Input
              id="explore-filter-lang"
              value={filters.lang}
              onChange={(e) => onChange({ ...filters, lang: e.target.value })}
              placeholder={t("explore.filterLang")}
              className="h-10 bg-transparent"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="explore-filter-genre">
              {t("explore.filterGenre")}
            </label>
            <Input
              id="explore-filter-genre"
              value={filters.genre}
              onChange={(e) => onChange({ ...filters, genre: e.target.value })}
              placeholder={t("explore.filterGenre")}
              className="h-10 bg-transparent"
            />
          </div>
        </div>
      </WorkspaceToolbar>
    </div>
  );
}
