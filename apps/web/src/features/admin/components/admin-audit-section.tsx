"use client";

import { useCallback, useMemo } from "react";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import { listAdminAuditLog } from "@/lib/api/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";

export function AdminAuditSection() {
  const { t } = useTranslations();
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminAuditLog(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        time: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
        actor: row.actor_username ? `@${row.actor_username}` : "—",
        action: <Badge variant="secondary">{row.action}</Badge>,
        target: (
          <span className="font-mono text-xs">
            {row.target_type}:{row.target_id}
          </span>
        ),
        details: (
          <span className="block max-w-[280px] truncate text-xs text-muted-foreground">
            {Object.keys(row.metadata).length ? JSON.stringify(row.metadata) : "—"}
          </span>
        ),
      })),
    [list.rows],
  );

  return (
    <AdminTableShell
      title={t("admin.auditTitle")}
      description={t("admin.auditDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchAudit")}
      search={list.search}
      onSearchChange={list.setSearch}
      onSearchSubmit={list.submitSearch}
      onRefresh={() => void list.reload()}
      loading={list.loading}
      total={list.total}
      page={list.page}
      pageCount={list.pageCount}
      onPrevPage={list.prevPage}
      onNextPage={list.nextPage}
    >
      <AdminDataTable
        loading={list.loading}
        emptyMessage={t("admin.emptyAudit")}
        columns={[
          { key: "time", header: t("admin.col.date") },
          { key: "actor", header: t("admin.audit.actor") },
          { key: "action", header: t("admin.audit.action") },
          { key: "target", header: t("admin.audit.target") },
          { key: "details", header: t("admin.col.meta") },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}
