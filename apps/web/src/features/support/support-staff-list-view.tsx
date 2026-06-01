"use client";

import { ChevronRight, Headphones, Loader2, Search, User, X } from "lucide-react";
import {
  CATEGORY_KEYS,
  PRIORITY_KEYS,
  STATUS_FILTERS,
  STATUS_KEYS,
  formatRelativeTime,
  priorityVariant,
  statusVariant,
  type SupportStatusFilter,
} from "@/features/support/model/support-ticket-meta";
import { SupportSocketBadge } from "@/features/support/components/support-socket-badge";
import type { useSupportPage } from "@/features/support/hooks/use-support-page";
import { WorkspaceEmpty, WorkspacePage } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { UserAvatar } from "@/shared/ui/user-avatar";
import type { SupportTicketRow, SupportTicketStatus } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type StaffListState = Pick<
  ReturnType<typeof useSupportPage>,
  "tickets" | "stats" | "loadingList" | "search" | "statusFilter" | "setSearch" | "setStatusFilter" | "openChat" | "inboxSocketState"
>;

function StatPill({ label, value, tone }: { label: string; value: number; tone?: "warning" | "brand" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "warning" && "border-amber-500/30 bg-amber-500/8",
        tone === "brand" && "border-brand/30 bg-brand/8",
        !tone && "border-[var(--workspace-divider)] bg-[var(--workspace-list)]",
      )}
    >
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StaffTicketListItem({ ticket, onSelect }: { ticket: SupportTicketRow; onSelect: () => void }) {
  const { t, locale } = useTranslations();
  const unread = ticket.unread_count > 0;
  const requester = ticket.requester_username ?? ticket.requester?.username ?? "?";
  const timeLabel = formatRelativeTime(ticket.last_message_at ?? ticket.updated_at, locale);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-start transition-all sm:gap-4 sm:px-5 sm:py-4",
          "border-[var(--workspace-divider)] bg-[var(--workspace-list)] hover:border-brand/35 hover:bg-brand/[0.04]",
          unread && "border-s-[3px] border-s-brand border-brand/25 bg-brand/[0.03]",
        )}
      >
        <UserAvatar username={requester} avatarUrl={ticket.requester?.avatar_url} className="size-11 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="line-clamp-2 font-medium leading-snug text-foreground">{ticket.subject}</span>
            {timeLabel ? <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">{timeLabel}</span> : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3 shrink-0" aria-hidden />
            @{requester}
          </span>
          {ticket.last_message_preview ? (
            <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">{ticket.last_message_preview}</span>
          ) : null}
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={statusVariant(ticket.status)} className="h-5 px-2 text-[10px]">
              {t(STATUS_KEYS[ticket.status])}
            </Badge>
            <Badge variant={priorityVariant(ticket.priority)} className="h-5 px-2 text-[10px]">
              {t(PRIORITY_KEYS[ticket.priority])}
            </Badge>
            {CATEGORY_KEYS[ticket.category] ? (
              <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
                {t(CATEGORY_KEYS[ticket.category])}
              </Badge>
            ) : null}
            <span className="font-mono text-[10px] text-muted-foreground/80">{ticket.reference}</span>
            {unread ? (
              <span className="ms-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                {ticket.unread_count > 9 ? "9+" : ticket.unread_count}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/60 group-hover:text-brand rtl:rotate-180" aria-hidden />
      </button>
    </li>
  );
}

function statusFilterLabel(st: SupportStatusFilter, t: (key: MessageKey) => string): string {
  return st === "all" ? t("support.filter.all") : t(STATUS_KEYS[st as SupportTicketStatus]);
}

export function SupportStaffListView({ state }: { state: StaffListState }) {
  const { t } = useTranslations();
  const { tickets, stats, loadingList, search, statusFilter, setSearch, setStatusFilter, openChat, inboxSocketState } = state;

  return (
    <WorkspacePage className="gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold sm:text-xl">{t("support.staffInboxTitle")}</h2>
          <SupportSocketBadge state={inboxSocketState} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("support.staffSubtitle")}</p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill label={t("support.stats.waiting")} value={stats.waiting_staff} tone="warning" />
          <StatPill label={t("support.stats.active")} value={stats.total_active} tone="brand" />
          <StatPill label={t("support.status.in_progress")} value={stats.in_progress} />
          <StatPill label={t("support.status.waiting_user")} value={stats.waiting_user} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="h-10 bg-transparent ps-9 pe-9"
            placeholder={t("support.staffSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("support.search")}
          />
          {search ? (
            <button
              type="button"
              className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
              onClick={() => setSearch("")}
              aria-label={t("playlists.clearSearch")}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <Select
          className="h-10 w-full shrink-0 sm:w-auto sm:min-w-[11rem]"
          value={statusFilter}
          valid={statusFilter !== "all"}
          onChange={(e) => setStatusFilter(e.target.value as SupportStatusFilter)}
          aria-label={t("support.filterStatus")}
        >
          {STATUS_FILTERS.map((st) => (
            <option key={st} value={st}>
              {statusFilterLabel(st, t)}
            </option>
          ))}
        </Select>
      </div>

      {loadingList ? (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("support.loadingList")}
        </div>
      ) : tickets.length === 0 ? (
        <WorkspaceEmpty icon={Headphones} title={t("support.staffEmptyList")} className="py-16" />
      ) : (
        <ul className="flex flex-col gap-2.5 sm:gap-3">
          {tickets.map((tk) => (
            <StaffTicketListItem key={tk.id} ticket={tk} onSelect={() => void openChat(tk)} />
          ))}
        </ul>
      )}
    </WorkspacePage>
  );
}
