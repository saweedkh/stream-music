"use client";

import { useCallback, useEffect, useState } from "react";
import { SupportTicketChatView } from "@/features/support/support-ticket-chat-view";
import { SupportTicketListView } from "@/features/support/support-ticket-list-view";
import { useSupportPage, type SupportScreen } from "@/features/support/hooks/use-support-page";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import type { AuthUser, SupportTicketRow } from "@/lib/api";
import { cn } from "@/lib/utils";

type SupportHubProps = {
  user: AuthUser | null;
  onScreenChange?: (screen: SupportScreen) => void;
};

export function SupportHub({ user: _user, onScreenChange }: SupportHubProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const onError = useCallback(
    (code: string) => {
      const map: Record<string, string> = {
        load_failed: t("support.loadFailed"),
        create_failed: t("support.createFailed"),
        send_failed: t("support.sendFailed"),
        update_failed: t("support.updateFailed"),
        attachment_too_large: t("support.attachmentTooLarge"),
        invalid_attachment_type: t("support.attachmentInvalidType"),
        invalid_attachment: t("support.attachmentInvalidType"),
        invalid_payload: t("api.error.invalid_payload"),
        too_many_open: t("support.tooManyOpen"),
      };
      showToast(map[code] ?? code, "error");
    },
    [showToast, t],
  );

  const state = useSupportPage({ onError });

  useEffect(() => {
    onScreenChange?.(state.screen);
  }, [onScreenChange, state.screen]);

  async function handleCreated(ticket: SupportTicketRow) {
    setCreateOpen(false);
    showToast(t("support.ticketCreated"), "success");
    await state.openChat(ticket);
  }

  if (state.screen === "chat") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-background",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-14 max-lg:z-20",
          "lg:h-full lg:min-h-0",
        )}
      >
        <SupportTicketChatView state={state} />
      </div>
    );
  }

  return (
    <SupportTicketListView
      state={state}
      createOpen={createOpen}
      onCreateOpenChange={setCreateOpen}
      onCreated={(ticket) => void handleCreated(ticket)}
    />
  );
}
