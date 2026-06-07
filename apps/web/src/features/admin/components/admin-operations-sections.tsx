"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  listAdminJoinRequests,
  listAdminLiveSessions,
  listAdminModerationReports,
  listAdminPremiumRedemptions,
  listAdminSuggestions,
  patchAdminModerationReport,
} from "@/lib/api/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast-provider";

function StatusFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function AdminModerationSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [status, setStatus] = useState("open");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) =>
      listAdminModerationReports({ ...opts, status }),
    [status],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        channel: (
          <div>
            <p className="font-medium">{row.channel_name}</p>
            <p className="text-xs text-muted-foreground">#{row.channel_id}</p>
          </div>
        ),
        message: <p className="max-w-[240px] truncate text-xs text-muted-foreground">{row.message_preview || "—"}</p>,
        reporter: `@${row.reporter_username}`,
        reason: row.reason || "—",
        status: (
          <Badge variant={row.status === "open" ? "warning" : "secondary"}>
            {row.status === "open" ? t("admin.statusOpen") : t("admin.statusDismissed")}
          </Badge>
        ),
        actions:
          row.status === "open" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyId === row.id}
              onClick={async () => {
                setBusyId(row.id);
                try {
                  await patchAdminModerationReport(row.id, { status: "dismissed" });
                  await list.reload();
                  showToast(t("admin.reportDismissed"), "success");
                } catch (e) {
                  showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
                } finally {
                  setBusyId(null);
                }
              }}
            >
              {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.dismissReport")}
            </Button>
          ) : (
            "—"
          ),
      })),
    [busyId, list.reload, list.rows, showToast, t],
  );

  return (
    <AdminTableShell
      title={t("admin.moderationTitle")}
      description={t("admin.moderationDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchModeration")}
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
      toolbarExtra={
        <StatusFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            void list.reload();
          }}
          options={[
            { value: "open", label: t("admin.filterOpen") },
            { value: "dismissed", label: t("admin.filterDismissed") },
            { value: "all", label: t("admin.filterAll") },
          ]}
        />
      }
    >
      <AdminDataTable
        loading={list.loading}
        emptyMessage={t("admin.emptyModeration")}
        columns={[
          { key: "channel", header: t("channels.name") },
          { key: "message", header: t("admin.col.message") },
          { key: "reporter", header: t("admin.col.reporter") },
          { key: "reason", header: t("admin.col.reason") },
          { key: "status", header: t("admin.col.status") },
          { key: "actions", header: "" },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminJoinRequestsSection() {
  const { t } = useTranslations();
  const [status, setStatus] = useState("pending");

  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminJoinRequests({ ...opts, status }),
    [status],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        channel: (
          <Link href={`/channel/${row.channel_id}`} className="font-medium text-brand hover:underline">
            {row.channel_name}
          </Link>
        ),
        user: `@${row.username}`,
        status: (
          <Badge
            variant={
              row.status === "pending" ? "warning" : row.status === "approved" ? "success" : "secondary"
            }
          >
            {row.status}
          </Badge>
        ),
        date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
      })),
    [list.rows],
  );

  return (
    <AdminTableShell
      title={t("admin.joinRequestsTitle")}
      description={t("admin.joinRequestsDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchJoinRequests")}
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
      toolbarExtra={
        <StatusFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            void list.reload();
          }}
          options={[
            { value: "pending", label: t("admin.filterPending") },
            { value: "approved", label: t("admin.filterApproved") },
            { value: "rejected", label: t("admin.filterRejected") },
            { value: "all", label: t("admin.filterAll") },
          ]}
        />
      }
    >
      <AdminDataTable
        loading={list.loading}
        emptyMessage={t("admin.emptyJoinRequests")}
        columns={[
          { key: "channel", header: t("channels.name") },
          { key: "user", header: t("admin.col.user") },
          { key: "status", header: t("admin.col.status") },
          { key: "date", header: t("admin.col.date") },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminSuggestionsSection() {
  const { t } = useTranslations();
  const [status, setStatus] = useState("pending");

  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminSuggestions({ ...opts, status }),
    [status],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        track: <span className="font-medium">{row.title}</span>,
        channel: (
          <Link href={`/channel/${row.channel_id}`} className="text-brand hover:underline">
            {row.channel_name}
          </Link>
        ),
        user: `@${row.username}`,
        status: (
          <Badge
            variant={
              row.status === "pending" ? "warning" : row.status === "approved" ? "success" : "secondary"
            }
          >
            {row.status}
          </Badge>
        ),
        date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
      })),
    [list.rows],
  );

  return (
    <AdminTableShell
      title={t("admin.suggestionsTitle")}
      description={t("admin.suggestionsDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchSuggestions")}
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
      toolbarExtra={
        <StatusFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            void list.reload();
          }}
          options={[
            { value: "pending", label: t("admin.filterPending") },
            { value: "approved", label: t("admin.filterApproved") },
            { value: "rejected", label: t("admin.filterRejected") },
            { value: "all", label: t("admin.filterAll") },
          ]}
        />
      }
    >
      <AdminDataTable
        loading={list.loading}
        emptyMessage={t("admin.emptySuggestions")}
        columns={[
          { key: "track", header: t("tracks.title") },
          { key: "channel", header: t("channels.name") },
          { key: "user", header: t("admin.col.user") },
          { key: "status", header: t("admin.col.status") },
          { key: "date", header: t("admin.col.date") },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminLiveSection() {
  const { t } = useTranslations();
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminLiveSessions(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        channel: (
          <div>
            <Link href={`/channel/${row.channel_id}`} className="font-medium text-brand hover:underline">
              {row.channel_name}
            </Link>
            <p className="text-xs text-muted-foreground">@{row.owner_username ?? "—"}</p>
          </div>
        ),
        track: row.track_title ?? "—",
        privacy: <Badge variant="secondary">{row.privacy}</Badge>,
        meta: (
          <span className="text-xs text-muted-foreground">
            {t("admin.liveRate")}: {row.playback_rate}x · Q{row.queue_version}
          </span>
        ),
        actions: (
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/channel/${row.channel_id}`}>
              <ExternalLink className="h-4 w-4 me-1" />
              {t("channels.enterRoom")}
            </Link>
          </Button>
        ),
      })),
    [list.rows, t],
  );

  return (
    <AdminTableShell
      title={t("admin.liveTitle")}
      description={t("admin.liveDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchLive")}
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
        emptyMessage={t("admin.emptyLive")}
        columns={[
          { key: "channel", header: t("channels.name") },
          { key: "track", header: t("tracks.title") },
          { key: "privacy", header: t("admin.col.privacy") },
          { key: "meta", header: t("admin.col.meta") },
          { key: "actions", header: "" },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminRedemptionsSection() {
  const { t } = useTranslations();
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminPremiumRedemptions(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        code: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{row.code}</code>,
        user: `@${row.username}`,
        date: row.redeemed_at ? new Date(row.redeemed_at).toLocaleString() : "—",
      })),
    [list.rows],
  );

  return (
    <AdminTableShell
      title={t("admin.redemptionsTitle")}
      description={t("admin.redemptionsDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchRedemptions")}
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
        emptyMessage={t("admin.emptyRedemptions")}
        columns={[
          { key: "code", header: t("admin.col.code") },
          { key: "user", header: t("admin.col.user") },
          { key: "date", header: t("admin.col.date") },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}
