"use client";

import { useCallback, useEffect } from "react";
import { SupportStaffChatView } from "@/features/support/support-staff-chat-view";
import { SupportStaffListView } from "@/features/support/support-staff-list-view";
import { useSupportPage, type SupportScreen } from "@/features/support/hooks/use-support-page";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { cn } from "@/lib/utils";

type SupportStaffHubProps = {
  onScreenChange?: (screen: SupportScreen) => void;
};

export function SupportStaffHub({ onScreenChange }: SupportStaffHubProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();

  const onError = useCallback(
    (code: string) => {
      const map: Record<string, string> = {
        load_failed: t("support.loadFailed"),
        send_failed: t("support.sendFailed"),
        update_failed: t("support.updateFailed"),
        attachment_too_large: t("support.attachmentTooLarge"),
        attachment_invalid_type: t("support.attachmentInvalidType"),
        invalid_attachment: t("support.attachmentInvalidType"),
      };
      showToast(map[code] ?? code, "error");
    },
    [showToast, t],
  );

  const state = useSupportPage({ onError, mode: "staff" });

  useEffect(() => {
    onScreenChange?.(state.screen);
  }, [onScreenChange, state.screen]);

  if (state.screen === "chat") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-background",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-14 max-lg:z-20",
          "lg:h-full lg:min-h-0",
        )}
      >
        <SupportStaffChatView state={state} />
      </div>
    );
  }

  return <SupportStaffListView state={state} />;
}
