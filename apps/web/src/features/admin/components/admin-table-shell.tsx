"use client";

import type { ReactNode } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";

type AdminTableShellProps = {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  total?: number;
  page?: number;
  pageCount?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  toolbarExtra?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminTableShell({
  title,
  description,
  searchPlaceholder,
  search,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  loading,
  total,
  page,
  pageCount,
  onPrevPage,
  onNextPage,
  toolbarExtra,
  children,
  className,
}: AdminTableShellProps) {
  const { t } = useTranslations();

  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      <CardHeader className="space-y-3 border-b border-border/40 bg-muted/20 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {onRefresh ? (
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={onRefresh}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("common.refresh")}
            </Button>
          ) : null}
        </div>
        {onSearchChange ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="ps-9"
                placeholder={searchPlaceholder}
                value={search ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearchSubmit?.();
                }}
              />
            </div>
            <Button type="button" size="sm" onClick={onSearchSubmit}>
              {t("admin.searchAction")}
            </Button>
            {toolbarExtra}
          </div>
        ) : (
          toolbarExtra
        )}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
      {page != null && pageCount != null && total != null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-4 py-3 text-xs text-muted-foreground">
          <span>{t("admin.paginationSummary", { total: String(total), page: String(page), pages: String(pageCount) })}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1 || loading} onClick={onPrevPage}>
              {t("admin.prevPage")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={page >= pageCount || loading} onClick={onNextPage}>
              {t("admin.nextPage")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

type AdminDataTableProps = {
  columns: { key: string; header: string; className?: string }[];
  rows: Record<string, ReactNode>[];
  loading?: boolean;
  emptyMessage?: string;
};

export function AdminDataTable({ columns, rows, loading, emptyMessage }: AdminDataTableProps) {
  const { t } = useTranslations();

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        {t("common.loading")}
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage ?? t("admin.empty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((col) => (
              <th key={col.key} className={cn("px-4 py-3 font-medium", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/30 transition-colors hover:bg-muted/20">
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
