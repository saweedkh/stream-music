"use client";

import { useTranslations } from "@/shared/providers/locale-provider";
import { ADMIN_TAB_META } from "@/features/channels/components/channel-admin-nav-meta";
import type { ChannelTabId } from "@/features/channels/components/channel-room-config";

type Props = {
  activeTab: ChannelTabId;
};

export function ChannelAdminPageHeader({ activeTab }: Props) {
  const { t } = useTranslations();
  const meta = ADMIN_TAB_META[activeTab];

  return (
    <header className="mb-4 shrink-0 sm:mb-5">
      <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {t(meta.titleKey)}
      </h1>
    </header>
  );
}
