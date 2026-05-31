"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus, Search, Trash2, Unlink, X } from "lucide-react";
import { CreatePlaylistForm, type PlaylistLinkMode } from "@/features/playlists/components/create-playlist-form";
import { PlaylistConfirmDialog } from "@/features/playlists/components/playlist-confirm-dialog";
import { PlaylistDetail } from "@/features/playlists/components/playlist-detail";
import { PlaylistSidebar } from "@/features/playlists/components/playlist-sidebar";
import { AddTracksDialog } from "@/features/playlists/components/add-tracks-dialog";
import { AddPlaylistToChannelDialog } from "@/features/playlists/components/add-playlist-to-channel-dialog";
import { usePlaylistItems } from "@/features/playlists/hooks/use-playlist-items";
import { usePlaylistLibrary } from "@/features/playlists/hooks/use-playlist-library";
import {
  WorkspacePage,
  WorkspaceRail,
  WorkspaceRailCard,
  WorkspaceSplit,
  WorkspaceToolbar,
} from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { createPlaylistShareLink, getPlaylistShareLink, type PlaylistSummary } from "@/lib/api";

export function PlaylistsPage() {
  const { t } = useTranslations();
  const { showToast } = useToast();

  const onLibError = useCallback(
    (msg: string) => showToast(msg === "refresh_failed" ? t("playlists.cannotRefresh") : msg, "error"),
    [showToast, t],
  );
  const onItemsError = useCallback(
    (msg: string) => showToast(msg === "items_failed" ? t("playlists.cannotRefreshItems") : msg, "error"),
    [showToast, t],
  );

  const lib = usePlaylistLibrary(onLibError);
  const items = usePlaylistItems(lib.selectedId, onItemsError);

  const [createName, setCreateName] = useState("");
  const [createLinkMode, setCreateLinkMode] = useState<PlaylistLinkMode>("personal");
  const [createChannelId, setCreateChannelId] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [addTracksOpen, setAddTracksOpen] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelDialogPlaylist, setChannelDialogPlaylist] = useState(lib.selectedPlaylist);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [detachConfirm, setDetachConfirm] = useState(false);
  const [detachBusy, setDetachBusy] = useState(false);

  const channelName =
    lib.selectedPlaylist?.channel != null
      ? (lib.activeChannels.find((c) => c.id === lib.selectedPlaylist?.channel)?.name ?? null)
      : null;

  function resetCreateForm() {
    setCreateName("");
    setCreateLinkMode("personal");
    setCreateChannelId("");
  }

  async function handleCreate(name: string, channelId: number | null) {
    try {
      await lib.create(name, channelId);
      showToast(t("playlists.created"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.createFailed"), "error");
      throw e;
    }
  }

  async function submitCreate() {
    if (!createName.trim()) return;
    if (createLinkMode === "channel" && !createChannelId) return;
    setCreateBusy(true);
    try {
      await handleCreate(
        createName.trim(),
        createLinkMode === "channel" ? Number(createChannelId) : null,
      );
      resetCreateForm();
      setCreateSheetOpen(false);
    } catch {
      /* toast in handleCreate */
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleRename(id: number, name: string) {
    try {
      await lib.rename(id, name);
      showToast(t("playlists.renamed"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.renameFailed"), "error");
    }
  }

  function openChannelDialog(pl?: PlaylistSummary | null) {
    const target = pl ?? lib.selectedPlaylist;
    if (!target) return;
    setChannelDialogPlaylist(target);
    setChannelDialogOpen(true);
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    setDeleteBusy(true);
    try {
      await lib.remove(deleteId);
      showToast(t("playlists.deleted"), "success");
      setDeleteId(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.deleteFailed"), "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleAddTracks(trackIds: number[]) {
    if (!lib.selectedPlaylist) return;
    try {
      const result = await items.addBulk(trackIds);
      showToast(t("playlists.bulkAdded", { count: result.added }), "success");
      setAddTracksOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.bulkAddFailed"), "error");
    }
  }

  async function handleShare() {
    if (!lib.selectedPlaylist || lib.selectedPlaylist.channel) return;
    setShareBusy(true);
    try {
      let link = await getPlaylistShareLink(lib.selectedPlaylist.id);
      if (!link.active) link = await createPlaylistShareLink(lib.selectedPlaylist.id);
      const path = link.share_url ?? `/share/playlist/${link.token}`;
      const full = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
      await navigator.clipboard.writeText(full);
      showToast(t("share.playlist.copy"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("share.playlist.loadFailed"), "error");
    } finally {
      setShareBusy(false);
    }
  }

  async function confirmDetach() {
    if (!lib.selectedPlaylist) return;
    setDetachBusy(true);
    try {
      await lib.detachFromChannel(lib.selectedPlaylist.id);
      showToast(t("playlists.removedFromChannel"), "success");
      setDetachConfirm(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.removeFromChannelFailed"), "error");
    } finally {
      setDetachBusy(false);
    }
  }

  const sidebarProps = {
    playlists: lib.playlists,
    channels: lib.activeChannels,
    selectedId: lib.selectedId,
    onSelect: (id: number) => {
      lib.setSelectedId(id);
      items.setSearch("");
    },
    onCreateClick: () => setCreateSheetOpen(true),
    onRename: handleRename,
    onDelete: setDeleteId,
    onAddToChannel: openChannelDialog,
  };

  const createFormProps = {
    name: createName,
    linkMode: createLinkMode,
    channelId: createChannelId,
    channels: lib.activeChannels,
    busy: createBusy,
    onNameChange: setCreateName,
    onLinkModeChange: (mode: PlaylistLinkMode) => {
      setCreateLinkMode(mode);
      if (mode === "personal") setCreateChannelId("");
    },
    onChannelIdChange: setCreateChannelId,
    onCreate: () => void submitCreate(),
  };

  const createForm = <CreatePlaylistForm {...createFormProps} idPrefix="dash-playlist" />;

  if (lib.loading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t("playlists.loading")}
      </div>
    );
  }

  return (
    <>
      <WorkspacePage className="gap-4">
        <WorkspaceSplit
          main={
            <div className="flex flex-col gap-4">
              <WorkspaceToolbar>
                <div className="relative min-w-0">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    className="h-10 bg-transparent ps-9 pe-9"
                    placeholder={t("playlists.searchPlaylists")}
                    value={lib.search}
                    onChange={(e) => lib.setSearch(e.target.value)}
                    aria-label={t("playlists.searchPlaylists")}
                  />
                  {lib.search ? (
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
                      onClick={() => lib.setSearch("")}
                      aria-label={t("playlists.clearSearch")}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </WorkspaceToolbar>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="h-9 min-w-[7rem] flex-1 text-sm sm:flex-none sm:w-36"
                  value={lib.scope}
                  onChange={(e) => {
                    const next = e.target.value as typeof lib.scope;
                    lib.setScope(next);
                    if (next !== "channel") lib.setChannelFilterId(null);
                  }}
                  aria-label={t("playlists.filterScope")}
                >
                  <option value="all">{t("playlists.scopeAll")}</option>
                  <option value="personal">{t("playlists.scopePersonal")}</option>
                  <option value="channel">{t("playlists.scopeChannel")}</option>
                  <option value="favorites">{t("playlists.scopeFavorites")}</option>
                </Select>
                {lib.scope === "channel" && lib.activeChannels.length > 0 ? (
                  <Select
                    className="h-9 min-w-[7rem] flex-1 text-sm sm:flex-none sm:w-44"
                    value={lib.channelFilterId != null ? String(lib.channelFilterId) : ""}
                    onChange={(e) => lib.setChannelFilterId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">{t("playlists.allChannels")}</option>
                    {lib.activeChannels.map((ch) => (
                      <option key={ch.id} value={String(ch.id)}>
                        {ch.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>

              {lib.playlists.length > 0 ? (
                <div className="lg:hidden">
                  <Select
                    className="h-10 w-full text-sm"
                    value={lib.selectedId != null ? String(lib.selectedId) : ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      lib.setSelectedId(id);
                      items.setSearch("");
                    }}
                    aria-label={t("playlists.selectPlaylistHint")}
                  >
                    <option value="" disabled>
                      {t("playlists.selectPlaylistHint")}
                    </option>
                    {lib.playlists.map((pl) => (
                      <option key={pl.id} value={String(pl.id)}>
                        {pl.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div className="flex min-h-[min(28rem,60vh)] flex-col gap-5 lg:flex-row lg:gap-6">
                <aside className="hidden w-full shrink-0 lg:block lg:w-56 xl:w-64">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("playlists.playlistsTitle")}
                  </p>
                  <PlaylistSidebar {...sidebarProps} />
                </aside>

                <main className="min-w-0 flex-1 lg:border-s lg:border-border/50 lg:ps-6">
                  <PlaylistDetail
                    playlist={lib.selectedPlaylist}
                    channelName={channelName}
                    items={items.items}
                    totalItems={items.allItems.length}
                    itemsLoading={items.loading}
                    search={items.search}
                    onSearchChange={items.setSearch}
                    isFiltering={items.isFiltering}
                    draggingId={items.draggingId}
                    onDragStart={items.setDraggingId}
                    onDrop={(index) => {
                      if (items.draggingId == null) return;
                      void items
                        .reorder(items.draggingId, index)
                        .catch((e) => showToast(e instanceof Error ? e.message : t("playlists.reorderFailed"), "error"))
                        .finally(() => items.setDraggingId(null));
                    }}
                    onMoveItem={(itemId, targetIndex) => {
                      if (items.isFiltering) return;
                      if (targetIndex < 0 || targetIndex >= items.allItems.length) return;
                      void items
                        .reorder(itemId, targetIndex)
                        .catch((e) => showToast(e instanceof Error ? e.message : t("playlists.reorderFailed"), "error"));
                    }}
                    onRemoveItem={(id) => {
                      void items
                        .removeItem(id)
                        .then(() => showToast(t("playlists.trackRemoved"), "success"))
                        .catch((e) =>
                          showToast(e instanceof Error ? e.message : t("playlists.removeTrackFailed"), "error"),
                        );
                    }}
                    onAddTracks={() => setAddTracksOpen(true)}
                    onAddToChannel={() => openChannelDialog()}
                    onRemoveFromChannel={() => setDetachConfirm(true)}
                    onShare={() => void handleShare()}
                    onDelete={() => lib.selectedPlaylist && setDeleteId(lib.selectedPlaylist.id)}
                    shareBusy={shareBusy}
                    hasChannels={lib.activeChannels.length > 0}
                    canRemoveFromChannel={Boolean(lib.selectedPlaylist?.channel)}
                    favoriteBusy={lib.favoriteBusyId === lib.selectedPlaylist?.id}
                    onToggleFavorite={
                      lib.selectedPlaylist
                        ? () => {
                            void lib
                              .toggleFavorite(lib.selectedPlaylist!.id, !lib.selectedPlaylist!.is_favorited)
                              .then(() => showToast(t("favorites.updated"), "success"))
                              .catch((e) =>
                                showToast(e instanceof Error ? e.message : t("favorites.updateFailed"), "error"),
                              );
                          }
                        : undefined
                    }
                  />
                </main>
              </div>
            </div>
          }
          aside={
            <WorkspaceRail className="hidden xl:block xl:w-[18rem] 2xl:w-[19rem]">
              <div className="workspace-rail sticky top-0 overflow-hidden">
                <div className="border-b border-[var(--workspace-divider)] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                      <Plus className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-semibold leading-tight">{t("playlists.newPlaylist")}</h3>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t("playlists.createSubtitle")}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <CreatePlaylistForm {...createFormProps} idPrefix="dash-playlist-rail" layout="rail" />
                </div>
              </div>
            </WorkspaceRail>
          }
        />

        <div className="fixed bottom-[calc(var(--player-mini-inset,0px)+1rem+env(safe-area-inset-bottom))] end-4 z-30 xl:hidden">
          <Button
            type="button"
            size="icon"
            className="size-12 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand-strong"
            onClick={() => setCreateSheetOpen(true)}
            aria-label={t("playlists.newPlaylist")}
          >
            <Plus className="size-5" aria-hidden />
          </Button>
        </div>
      </WorkspacePage>

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent side="bottom" className="gap-0 p-0">
          <SheetTitle className="sr-only">{t("playlists.newPlaylist")}</SheetTitle>
          <WorkspaceRailCard
            icon={Plus}
            title={t("playlists.newPlaylist")}
            description={t("playlists.createSubtitle")}
            className="border-0 shadow-none"
          >
            {createForm}
          </WorkspaceRailCard>
        </SheetContent>
      </Sheet>

      {lib.selectedPlaylist ? (
        <AddTracksDialog
          open={addTracksOpen}
          onOpenChange={setAddTracksOpen}
          playlistName={lib.selectedPlaylist.name}
          existingTrackIds={items.trackIdsInPlaylist}
          onAdd={handleAddTracks}
          bulkBusy={items.bulkBusy}
          bulkProgress={items.bulkProgress}
        />
      ) : null}

      <AddPlaylistToChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        playlist={channelDialogPlaylist}
        channels={lib.activeChannels}
        currentUserId={lib.currentUserId}
        onComplete={() => void lib.refresh()}
      />

      <PlaylistConfirmDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        icon={Trash2}
        title={t("playlists.deleteDialogTitle")}
        description={t("playlists.deleteDialogDescription", {
          name: lib.allPlaylists.find((p) => p.id === deleteId)?.name ?? "",
        })}
        confirmLabel={t("playlists.delete")}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        destructive
      />

      <PlaylistConfirmDialog
        open={detachConfirm}
        onOpenChange={setDetachConfirm}
        icon={Unlink}
        title={t("playlists.removeFromChannelTitle")}
        description={t("playlists.removeFromChannelDescription")}
        confirmLabel={t("playlists.removeFromChannel")}
        onConfirm={confirmDetach}
        busy={detachBusy}
      />
    </>
  );
}
