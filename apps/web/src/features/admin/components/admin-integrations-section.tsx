"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Key, Webhook, Zap } from "lucide-react";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  exportAdminWebhookDeliveries,
  getAdminIntegrationsOverview,
  listAdminApiTokens,
  listAdminWebhookDeliveries,
  listAdminWebhooks,
  patchAdminWebhook,
} from "@/lib/api/admin";
import type { AdminIntegrationsOverview } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";
import { AdminDateRangeToolbar, AdminExportCsvButton } from "@/features/admin/components/admin-list-toolbar";

type IntegrationsTab = "webhooks" | "deliveries" | "tokens";

export function AdminIntegrationsSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [tab, setTab] = useState<IntegrationsTab>("webhooks");
  const [overview, setOverview] = useState<AdminIntegrationsOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const webhooksFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminWebhooks(opts),
    [],
  );
  const deliveriesFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number; dateFrom?: string; dateTo?: string }) =>
      listAdminWebhookDeliveries(opts),
    [],
  );
  const tokensFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminApiTokens(opts),
    [],
  );

  const webhooks = useAdminPaginatedList(webhooksFetcher);
  const deliveries = useAdminPaginatedList(deliveriesFetcher, { withDateRange: true });
  const tokens = useAdminPaginatedList(tokensFetcher);

  useEffect(() => {
    void getAdminIntegrationsOverview()
      .then(setOverview)
      .catch(() => showToast(t("admin.loadFailed"), "error"))
      .finally(() => setLoadingOverview(false));
  }, [showToast, t]);

  const webhookRows = useMemo(
    () =>
      webhooks.rows.map((row) => ({
        owner: `@${row.owner_username}`,
        url: <span className="block max-w-[220px] truncate text-xs">{row.url}</span>,
        events: (row.events as string[]).join(", ") || "—",
        status: row.is_active ? <Badge variant="success">{t("admin.active")}</Badge> : <Badge variant="warning">{t("admin.inactive")}</Badge>,
        actions: (
          <Switch
            checked={row.is_active}
            disabled={busyId === row.id}
            onCheckedChange={async (checked) => {
              setBusyId(row.id);
              try {
                await patchAdminWebhook(row.id, { is_active: checked });
                await webhooks.reload();
              } catch (e) {
                showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
              } finally {
                setBusyId(null);
              }
            }}
          />
        ),
      })),
    [busyId, showToast, t, webhooks],
  );

  if (loadingOverview && !overview) return <Skeleton className="h-80 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard label={t("admin.integrations.webhooks")} value={overview.webhooks_active} sub={`/ ${overview.webhooks_total}`} icon={Webhook} accent="brand" />
          <AdminStatCard label={t("admin.integrations.deliveries")} value={overview.deliveries_total} sub={t("admin.integrations.failed", { count: overview.deliveries_failed })} icon={Zap} accent="amber" />
          <AdminStatCard label={t("admin.integrations.apiTokens")} value={overview.api_tokens_active} sub={`/ ${overview.api_tokens_total}`} icon={Key} accent="violet" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "webhooks" as const, label: t("admin.integrations.tab.webhooks") },
            { id: "deliveries" as const, label: t("admin.integrations.tab.deliveries") },
            { id: "tokens" as const, label: t("admin.integrations.tab.tokens") },
          ] as const
        ).map((item) => (
          <Button key={item.id} type="button" size="sm" variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "webhooks" ? (
        <AdminTableShell
          title={t("admin.integrations.webhooksTitle")}
          searchPlaceholder={t("admin.searchIntegrations")}
          search={webhooks.search}
          onSearchChange={webhooks.setSearch}
          onSearchSubmit={webhooks.submitSearch}
          onRefresh={() => void webhooks.reload()}
          loading={webhooks.loading}
          total={webhooks.total}
          page={webhooks.page}
          pageCount={webhooks.pageCount}
          onPrevPage={webhooks.prevPage}
          onNextPage={webhooks.nextPage}
        >
          <AdminDataTable
            loading={webhooks.loading}
            emptyMessage={t("admin.integrations.emptyWebhooks")}
            columns={[
              { key: "owner", header: t("admin.col.owner") },
              { key: "url", header: "URL" },
              { key: "events", header: t("admin.integrations.events") },
              { key: "status", header: t("admin.col.status") },
              { key: "actions", header: "" },
            ]}
            rows={webhookRows}
          />
        </AdminTableShell>
      ) : null}

      {tab === "deliveries" ? (
        <AdminTableShell
          title={t("admin.integrations.deliveriesTitle")}
          searchPlaceholder={t("admin.searchIntegrations")}
          search={deliveries.search}
          onSearchChange={deliveries.setSearch}
          onSearchSubmit={deliveries.submitSearch}
          onRefresh={() => void deliveries.reload()}
          loading={deliveries.loading}
          total={deliveries.total}
          page={deliveries.page}
          pageCount={deliveries.pageCount}
          onPrevPage={deliveries.prevPage}
          onNextPage={deliveries.nextPage}
          toolbarExtra={
            <div className="flex flex-wrap items-end gap-2">
              <AdminDateRangeToolbar
                dateFrom={deliveries.dateFrom}
                dateTo={deliveries.dateTo}
                onDateFromChange={deliveries.setDateFrom}
                onDateToChange={deliveries.setDateTo}
                onClear={deliveries.clearDateRange}
              />
              <AdminExportCsvButton
                disabled={exporting}
                onExport={async () => {
                  setExporting(true);
                  try {
                    await exportAdminWebhookDeliveries({
                      search: deliveries.appliedSearch || undefined,
                      dateFrom: deliveries.queryDateFrom || undefined,
                      dateTo: deliveries.queryDateTo || undefined,
                    });
                    showToast(t("admin.exportStarted"), "success");
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
                  } finally {
                    setExporting(false);
                  }
                }}
              />
            </div>
          }
        >
          <AdminDataTable
            loading={deliveries.loading}
            emptyMessage={t("admin.integrations.emptyDeliveries")}
            columns={[
              { key: "owner", header: t("admin.col.owner") },
              { key: "event", header: t("admin.integrations.events") },
              { key: "status", header: t("admin.col.status") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={deliveries.rows.map((row) => ({
              owner: `@${row.owner_username ?? "—"}`,
              event: row.event,
              status: (
                <Badge variant={row.success ? "success" : "warning"}>
                  {row.status_code ?? "—"} {row.success ? "OK" : "FAIL"}
                </Badge>
              ),
              date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
            }))}
          />
        </AdminTableShell>
      ) : null}

      {tab === "tokens" ? (
        <AdminTableShell
          title={t("admin.integrations.tokensTitle")}
          searchPlaceholder={t("admin.searchIntegrations")}
          search={tokens.search}
          onSearchChange={tokens.setSearch}
          onSearchSubmit={tokens.submitSearch}
          onRefresh={() => void tokens.reload()}
          loading={tokens.loading}
          total={tokens.total}
          page={tokens.page}
          pageCount={tokens.pageCount}
          onPrevPage={tokens.prevPage}
          onNextPage={tokens.nextPage}
        >
          <AdminDataTable
            loading={tokens.loading}
            emptyMessage={t("admin.integrations.emptyTokens")}
            columns={[
              { key: "user", header: t("admin.col.user") },
              { key: "name", header: t("admin.integrations.tokenName") },
              { key: "prefix", header: t("admin.integrations.tokenPrefix") },
              { key: "status", header: t("admin.col.status") },
            ]}
            rows={tokens.rows.map((row) => ({
              user: `@${row.username}`,
              name: row.name,
              prefix: <code className="text-xs">{row.token_prefix}…</code>,
              status: row.is_active ? t("admin.active") : t("admin.inactive"),
            }))}
          />
        </AdminTableShell>
      ) : null}
    </div>
  );
}
