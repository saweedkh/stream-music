"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  createAdminPremiumCode,
  deleteAdminPlaylist,
  deleteAdminTrack,
  listAdminPlaylists,
  listAdminPremiumCodes,
  listAdminTrackImports,
  listAdminTracks,
  patchAdminPremiumCode,
  patchAdminPlaylist,
  patchAdminTrack,
} from "@/lib/api/admin";
import type { AdminPremiumCodeRow } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast-provider";

export function AdminTracksSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminTracks(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  useEffect(() => {
    if (list.error) showToast(t("admin.loadFailed"), "error");
  }, [list.error, showToast, t]);

  async function removeTrack(id: number) {
    if (!window.confirm(t("admin.tracksDeleteConfirm"))) return;
    setBusyId(id);
    try {
      await deleteAdminTrack(id);
      await list.reload();
      showToast(t("admin.tracksDeleted"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        title: (
          <div className="min-w-0 space-y-1">
            <input
              className="h-8 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm font-medium"
              defaultValue={row.title}
              disabled={busyId === row.id}
              onBlur={async (e) => {
                const next = e.target.value.trim();
                if (!next || next === row.title) return;
                setBusyId(row.id);
                try {
                  await patchAdminTrack(row.id, { title: next });
                  await list.reload();
                  showToast(t("admin.trackUpdated"), "success");
                } catch (err) {
                  showToast(err instanceof Error ? err.message : t("admin.loadFailed"), "error");
                } finally {
                  setBusyId(null);
                }
              }}
            />
            <input
              className="h-7 w-full min-w-[120px] rounded-md border border-input/70 bg-background px-2 text-xs text-muted-foreground"
              defaultValue={row.artist}
              placeholder={t("tracks.artist")}
              disabled={busyId === row.id}
              onBlur={async (e) => {
                const next = e.target.value.trim();
                if (next === row.artist) return;
                setBusyId(row.id);
                try {
                  await patchAdminTrack(row.id, { artist: next });
                  await list.reload();
                  showToast(t("admin.trackUpdated"), "success");
                } catch (err) {
                  showToast(err instanceof Error ? err.message : t("admin.loadFailed"), "error");
                } finally {
                  setBusyId(null);
                }
              }}
            />
          </div>
        ),
        owner: `@${row.owner_username ?? row.owner_id}`,
        source: row.import_source ? <Badge variant="secondary">{row.import_source}</Badge> : <span className="text-muted-foreground">—</span>,
        visibility: (
          <select
            className="h-8 max-w-[9.5rem] rounded-md border border-input bg-background px-2 text-xs"
            value={row.visibility}
            disabled={busyId === row.id}
            onChange={async (e) => {
              setBusyId(row.id);
              try {
                await patchAdminTrack(row.id, { visibility: e.target.value });
                await list.reload();
                showToast(t("admin.trackUpdated"), "success");
              } catch (err) {
                showToast(err instanceof Error ? err.message : t("admin.loadFailed"), "error");
              } finally {
                setBusyId(null);
              }
            }}
            aria-label={t("admin.col.visibility")}
          >
            <option value="private">{t("tracks.visPrivate")}</option>
            <option value="shared_with_users">{t("tracks.visSharedUsers")}</option>
            <option value="shared_with_channels">{t("tracks.visSharedChannels")}</option>
            <option value="public_lan">{t("tracks.visPublicLan")}</option>
          </select>
        ),
        actions: (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busyId === row.id} onClick={() => void removeTrack(row.id)}>
            {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        ),
      })),
    [busyId, list.reload, list.rows, showToast, t],
  );

  return (
    <AdminTableShell
      title={t("admin.tracksTitle")}
      description={t("admin.tracksDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchTracks")}
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
        emptyMessage={t("admin.emptyTracks")}
        columns={[
          { key: "title", header: t("tracks.title") },
          { key: "owner", header: t("admin.col.owner") },
          { key: "source", header: t("admin.col.source") },
          { key: "visibility", header: t("admin.col.visibility") },
          { key: "actions", header: "", className: "w-16" },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminPlaylistsSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminPlaylists(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  async function remove(id: number) {
    if (!window.confirm(t("admin.playlistsDeleteConfirm"))) return;
    setBusyId(id);
    try {
      await deleteAdminPlaylist(id);
      await list.reload();
      showToast(t("admin.playlistsDeleted"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        name: (
          <input
            className="h-8 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm font-medium"
            defaultValue={row.name}
            disabled={busyId === row.id}
            onBlur={async (e) => {
              const next = e.target.value.trim();
              if (!next || next === row.name) return;
              setBusyId(row.id);
              try {
                await patchAdminPlaylist(row.id, { name: next });
                await list.reload();
                showToast(t("admin.playlistUpdated"), "success");
              } catch (err) {
                showToast(err instanceof Error ? err.message : t("admin.loadFailed"), "error");
              } finally {
                setBusyId(null);
              }
            }}
          />
        ),
        owner: `@${row.owner_username ?? row.owner_id}`,
        tracks: String(row.track_count),
        meta: row.is_auto_generated ? t("admin.playlistAuto") : row.channel_id ? `#${row.channel_id}` : "—",
        actions: (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busyId === row.id} onClick={() => void remove(row.id)}>
            {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        ),
      })),
    [busyId, list.rows, t],
  );

  return (
    <AdminTableShell
      title={t("admin.playlistsTitle")}
      description={t("admin.playlistsDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchPlaylists")}
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
        emptyMessage={t("admin.emptyPlaylists")}
        columns={[
          { key: "name", header: t("admin.col.playlistName") },
          { key: "owner", header: t("admin.col.owner") },
          { key: "tracks", header: t("admin.col.trackCount") },
          { key: "meta", header: t("admin.col.meta") },
          { key: "actions", header: "", className: "w-16" },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminTrackImportsSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminTrackImports(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((row) => ({
        title: row.title,
        owner: `@${row.owner_username}`,
        source: <Badge variant="secondary">{row.import_source}</Badge>,
        url: row.source_url ? (
          <a href={row.source_url} target="_blank" rel="noreferrer" className="block max-w-[220px] truncate text-brand hover:underline">
            {row.source_url}
          </a>
        ) : (
          "—"
        ),
        date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
      })),
    [list.rows],
  );

  return (
    <AdminTableShell
      title={t("admin.importsTitle")}
      description={t("admin.importsDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchImports")}
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
        emptyMessage={t("admin.emptyImports")}
        columns={[
          { key: "title", header: t("tracks.title") },
          { key: "owner", header: t("admin.col.owner") },
          { key: "source", header: t("admin.col.source") },
          { key: "url", header: "URL" },
          { key: "date", header: t("admin.col.date") },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminPremiumCodesSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AdminPremiumCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState("5");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminPremiumCodes();
      setRows(data.results);
    } catch {
      showToast(t("admin.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCode() {
    setBusyId(-1);
    try {
      const created = await createAdminPremiumCode({ max_uses: Number(maxUses) || 5, note: note.trim() });
      showToast(t("admin.premiumCreated", { code: created.code }), "success");
      setNote("");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(id: number, is_active: boolean) {
    setBusyId(id);
    try {
      await patchAdminPremiumCode(id, { is_active: !is_active });
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  const tableRows = rows.map((row) => ({
    code: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{row.code}</code>,
    uses: `${row.use_count} / ${row.max_uses}`,
    status: row.is_active ? <Badge variant="success">{t("admin.active")}</Badge> : <Badge variant="warning">{t("admin.inactive")}</Badge>,
    expires: row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "—",
    actions: (
      <Button type="button" size="sm" variant="outline" disabled={busyId === row.id} onClick={() => void toggleActive(row.id, row.is_active)}>
        {row.is_active ? t("admin.deactivate") : t("admin.activate")}
      </Button>
    ),
  }));

  return (
    <AdminTableShell
      title={t("admin.premiumTitle")}
      description={t("admin.premiumDescription")}
      onRefresh={() => void load()}
      loading={loading}
      toolbarExtra={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <input className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} aria-label={t("admin.premiumMaxUses")} />
          <input className="h-9 min-w-[120px] flex-1 rounded-md border border-input bg-background px-2 text-sm" placeholder={t("admin.premiumNote")} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="button" size="sm" disabled={busyId === -1} onClick={() => void createCode()}>
            {t("admin.premiumCreate")}
          </Button>
        </div>
      }
    >
      <AdminDataTable
        loading={loading}
        emptyMessage={t("admin.emptyPremium")}
        columns={[
          { key: "code", header: t("admin.col.code") },
          { key: "uses", header: t("admin.col.uses") },
          { key: "status", header: t("admin.col.status") },
          { key: "expires", header: t("admin.col.expires") },
          { key: "actions", header: "" },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}
