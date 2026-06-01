"use client";

import { Loader2 } from "lucide-react";
import {
  CATEGORY_KEYS,
  PRIORITY_KEYS,
  STATUS_KEYS,
} from "@/features/support/model/support-ticket-meta";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import type { SupportTicketPriority, SupportTicketRow, SupportTicketStatus } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Props = {
  ticket: SupportTicketRow;
  categories: Array<{ id: string; label: string }>;
  staffUsers: Array<{ id: number; username: string }>;
  patching?: boolean;
  onPatch: (fields: Partial<{
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    assigned_to_id: number | null;
    category: string;
  }>) => void | Promise<void>;
  className?: string;
};

const STATUS_OPTIONS: SupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_user",
  "waiting_staff",
  "resolved",
  "closed",
];

const PRIORITY_OPTIONS: SupportTicketPriority[] = ["low", "normal", "high", "urgent"];

export function SupportTicketManagePanel({ ticket, categories, staffUsers, patching, onPatch, className }: Props) {
  const { t } = useTranslations();
  const closed = ticket.status === "closed";

  return (
    <div className={cn("space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("support.manageTicket")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("support.statusLabel")}</Label>
          <Select
            className="h-9 text-sm"
            value={ticket.status}
            disabled={patching}
            onChange={(e) => void onPatch({ status: e.target.value as SupportTicketStatus })}
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {t(STATUS_KEYS[st])}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("support.priorityLabel")}</Label>
          <Select
            className="h-9 text-sm"
            value={ticket.priority}
            disabled={patching}
            onChange={(e) => void onPatch({ priority: e.target.value as SupportTicketPriority })}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {t(PRIORITY_KEYS[p])}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("support.category")}</Label>
          <Select
            className="h-9 text-sm"
            value={ticket.category}
            disabled={patching}
            onChange={(e) => void onPatch({ category: e.target.value })}
          >
            {categories.map((cat) => {
              const key = CATEGORY_KEYS[cat.id] as MessageKey | undefined;
              return (
                <option key={cat.id} value={cat.id}>
                  {key ? t(key) : cat.label}
                </option>
              );
            })}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("support.assigneeLabel")}</Label>
          <Select
            className="h-9 text-sm"
            value={ticket.assigned_to_id != null ? String(ticket.assigned_to_id) : ""}
            disabled={patching}
            onChange={(e) => {
              const raw = e.target.value;
              void onPatch({ assigned_to_id: raw ? Number(raw) : null });
            }}
          >
            <option value="">{t("support.unassigned")}</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={String(u.id)}>
                @{u.username}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {!closed && ticket.status !== "resolved" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={patching}
            onClick={() => void onPatch({ status: "resolved" })}
          >
            {patching ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {t("support.markResolved")}
          </Button>
        ) : null}
        {!closed ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={patching}
            onClick={() => void onPatch({ status: "closed" })}
          >
            {t("support.closeTicket")}
          </Button>
        ) : null}
        {ticket.status === "closed" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={patching}
            onClick={() => void onPatch({ status: "open" })}
          >
            {t("support.reopenTicket")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
