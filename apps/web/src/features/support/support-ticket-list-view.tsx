"use client";

import { useState } from "react";
import { ChevronRight, LifeBuoy, ListFilter, Loader2, MessageSquarePlus, Plus, Search, X } from "lucide-react";
import { CreateSupportTicketForm } from "@/features/support/components/create-support-ticket-form";
import {
  CATEGORY_KEYS,
  STATUS_FILTERS,
  STATUS_KEYS,
  formatRelativeTime,
  statusVariant,
  type SupportStatusFilter,
} from "@/features/support/model/support-ticket-meta";
import type { useSupportPage } from "@/features/support/hooks/use-support-page";
import {
  WorkspaceEmpty,
  WorkspacePage,
  WorkspaceRailCard,
  WorkspaceChip,
  WorkspaceChipGroup,
} from "@/shared/layout/workspace";
import { useIsLgUp } from "@/shared/hooks/use-media-query";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import type { SupportTicketRow, SupportTicketStatus } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type ListState = Pick<
  ReturnType<typeof useSupportPage>,
  | "tickets"
  | "loadingList"
  | "search"
  | "statusFilter"
  | "setSearch"
  | "setStatusFilter"
  | "openChat"
  | "categories"
  | "createSubject"
  | "createCategory"
  | "createBody"
  | "creating"
  | "setCreateSubject"
  | "setCreateCategory"
  | "setCreateBody"
  | "submitCreate"
>;

type SupportTicketListViewProps = {
  state: ListState;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onCreated: (ticket: SupportTicketRow) => void;
};

function TicketListItem({ ticket, onSelect }: { ticket: SupportTicketRow; onSelect: () => void }) {
  const { t, locale } = useTranslations();
  const unread = ticket.unread_count > 0;
  const waitingStaff = ticket.status === "waiting_staff";
  const timeLabel = formatRelativeTime(ticket.last_message_at ?? ticket.updated_at, locale);
  const categoryKey = CATEGORY_KEYS[ticket.category];

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3.5 text-start transition-all sm:gap-4 sm:px-5 sm:py-4",
          "border-[var(--workspace-divider)] bg-[var(--workspace-list)]",
          "hover:border-brand/35 hover:bg-brand/[0.04] hover:shadow-sm",
          unread && "border-s-[3px] border-s-brand border-brand/25 bg-brand/[0.03]",
        )}
      >
        <span
          className={cn(
            "relative flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
            waitingStaff ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-brand/12 text-brand group-hover:bg-brand/18",
          )}
        >
          <LifeBuoy className="size-5" aria-hidden />
          {unread ? (
            <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[var(--workspace-list)] bg-brand" aria-hidden />
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="line-clamp-2 font-medium leading-snug text-foreground sm:text-base">{ticket.subject}</span>
            {timeLabel ? (
              <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">{timeLabel}</span>
            ) : null}
          </span>

          {ticket.last_message_preview ? (
            <span className="mt-1 line-clamp-1 block text-sm leading-relaxed text-muted-foreground">{ticket.last_message_preview}</span>
          ) : null}

          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={statusVariant(ticket.status)} className="h-5 px-2 text-[10px] font-medium">
              {t(STATUS_KEYS[ticket.status])}
            </Badge>
            {categoryKey ? (
              <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
                {t(categoryKey)}
              </Badge>
            ) : null}
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground/80">{ticket.reference}</span>
            {unread ? (
              <span className="ms-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                {ticket.unread_count > 9 ? "9+" : ticket.unread_count}
              </span>
            ) : null}
          </span>
        </span>

        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          aria-hidden
        />
      </button>
    </li>
  );
}

function statusFilterLabel(st: SupportStatusFilter, t: (key: MessageKey) => string): string {
  return st === "all" ? t("support.filter.all") : t(STATUS_KEYS[st as SupportTicketStatus]);
}

function SupportTicketSearchBar({
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
}: {
  search: string;
  statusFilter: SupportStatusFilter;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: SupportStatusFilter) => void;
}) {
  const { t } = useTranslations();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterActive = statusFilter !== "all";

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        className="h-10 bg-transparent ps-9 pe-9"
        placeholder={t("support.search")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label={t("support.search")}
      />
      {search ? (
        <button
          type="button"
          className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          onClick={() => onSearchChange("")}
          aria-label={t("playlists.clearSearch")}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );

  const filterOptions = STATUS_FILTERS.map((st) => (
    <option key={st} value={st}>
      {statusFilterLabel(st, t)}
    </option>
  ));

  return (
    <>
      {/* Desktop: search + dropdown side by side */}
      <div className="hidden items-center gap-2 sm:flex">
        {searchField}
        <Select
          className="h-10 w-auto min-w-[11rem] shrink-0"
          value={statusFilter}
          valid={filterActive}
          onChange={(e) => onStatusFilterChange(e.target.value as SupportStatusFilter)}
          aria-label={t("support.filterStatus")}
        >
          {filterOptions}
        </Select>
      </div>

      {/* Mobile: fused bar + filter icon */}
      <div className="flex items-stretch overflow-hidden rounded-xl border border-[var(--workspace-divider)] bg-[var(--workspace-list)] shadow-sm sm:hidden">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="h-10 rounded-none border-0 bg-transparent ps-9 pe-9 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={t("support.search")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={t("support.search")}
          />
          {search ? (
            <button
              type="button"
              className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={() => onSearchChange("")}
              aria-label={t("playlists.clearSearch")}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="w-px shrink-0 self-stretch bg-[var(--workspace-divider)]" aria-hidden />

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "relative h-10 w-10 shrink-0 rounded-none",
                filterActive
                  ? "bg-brand/12 text-brand hover:bg-brand/18 hover:text-brand"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
              aria-label={t("support.filterStatus")}
            >
              <ListFilter className="size-4" aria-hidden />
              {filterActive ? (
                <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-brand" aria-hidden />
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-[min(18rem,calc(100vw-2rem))] p-3">
            <p className="mb-2.5 text-xs font-medium text-muted-foreground">{t("support.filterStatus")}</p>
            <WorkspaceChipGroup className="flex-wrap gap-1.5">
              {STATUS_FILTERS.map((st) => (
                <WorkspaceChip
                  key={st}
                  selected={statusFilter === st}
                  onClick={() => {
                    onStatusFilterChange(st);
                    setFilterOpen(false);
                  }}
                >
                  {statusFilterLabel(st, t)}
                </WorkspaceChip>
              ))}
            </WorkspaceChipGroup>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

export function SupportTicketListView({ state, createOpen, onCreateOpenChange, onCreated }: SupportTicketListViewProps) {
  const { t } = useTranslations();
  const isLgUp = useIsLgUp();
  const {
    tickets,
    loadingList,
    search,
    statusFilter,
    setSearch,
    setStatusFilter,
    openChat,
    categories,
    createSubject,
    createCategory,
    createBody,
    creating,
    setCreateSubject,
    setCreateCategory,
    setCreateBody,
    submitCreate,
  } = state;

  function handleCreate(closeSheet: boolean) {
    void (async () => {
      const row = await submitCreate();
      if (!row) return;
      if (closeSheet) onCreateOpenChange(false);
      onCreated(row);
    })();
  }

  const createForm = (
    <CreateSupportTicketForm
      subject={createSubject}
      category={createCategory}
      body={createBody}
      categories={categories}
      busy={creating}
      onSubjectChange={setCreateSubject}
      onCategoryChange={setCreateCategory}
      onBodyChange={setCreateBody}
      onCreate={() => handleCreate(true)}
      idPrefix={isLgUp ? "support-dialog" : "support-sheet"}
    />
  );

  return (
    <>
      <WorkspacePage className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold sm:text-xl">{t("support.inboxTitle")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("support.userSubtitle")}</p>
          </div>
          <Button
            type="button"
            className="hidden gap-2 bg-brand text-brand-foreground hover:bg-brand-strong lg:inline-flex"
            onClick={() => onCreateOpenChange(true)}
          >
            <Plus className="size-4" aria-hidden />
            {t("support.newTicket")}
          </Button>
        </div>

        <SupportTicketSearchBar
          search={search}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
        />

        {loadingList ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {t("support.loadingList")}
          </div>
        ) : tickets.length === 0 ? (
          <WorkspaceEmpty icon={LifeBuoy} title={t("support.emptyList")} className="py-16">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3 lg:hidden"
              onClick={() => onCreateOpenChange(true)}
            >
              <Plus className="size-4" aria-hidden />
              {t("support.newTicket")}
            </Button>
          </WorkspaceEmpty>
        ) : (
          <ul className="flex flex-col gap-2.5 sm:gap-3">
            {tickets.map((tk) => (
              <TicketListItem key={tk.id} ticket={tk} onSelect={() => void openChat(tk)} />
            ))}
          </ul>
        )}

        <div className="fixed bottom-[calc(var(--player-mini-inset,0px)+1rem+env(safe-area-inset-bottom))] end-4 z-30 lg:hidden">
          <Button
            type="button"
            size="icon"
            className="size-12 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand-strong"
            onClick={() => onCreateOpenChange(true)}
            aria-label={t("support.newTicket")}
          >
            <Plus className="size-5" aria-hidden />
          </Button>
        </div>
      </WorkspacePage>

      <Dialog open={createOpen && isLgUp} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-xl gap-0 p-0">
          <DialogHeader className="border-b border-[var(--workspace-divider)] px-5 py-4 text-start sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                <MessageSquarePlus className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <DialogTitle className="font-display text-base">{t("support.newTicket")}</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">{t("support.createSubtitle")}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-5 py-4 sm:px-6">{createForm}</div>
        </DialogContent>
      </Dialog>

      <Sheet open={createOpen && !isLgUp} onOpenChange={onCreateOpenChange}>
        <SheetContent side="bottom" className="gap-0 p-0">
          <SheetTitle className="sr-only">{t("support.newTicket")}</SheetTitle>
          <WorkspaceRailCard
            icon={MessageSquarePlus}
            title={t("support.newTicket")}
            description={t("support.createSubtitle")}
            className="border-0 shadow-none"
          >
            {createForm}
          </WorkspaceRailCard>
        </SheetContent>
      </Sheet>
    </>
  );
}
