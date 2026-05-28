"use client";

import { useTranslations } from "@/shared/providers/locale-provider";
import { LISTENER_TAB_META } from "@/features/channels/components/channel-listener-nav-meta";
import type { ListenerTabId } from "@/features/channels/components/channel-room-config";

type Props = {
  activeTab: ListenerTabId;
};

export function ChannelListenerPageHeader({ activeTab }: Props) {
  const { t } = useTranslations();
  const meta = LISTENER_TAB_META[activeTab];

  return (
    <header className="mb-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
        {t(meta.titleKey)}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t(meta.descriptionKey)}</p>
    </header>
  );
}
