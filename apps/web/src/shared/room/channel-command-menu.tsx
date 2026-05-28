"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, ListMusic, MessageSquare, Radio, Search, Settings2, Sparkles } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

type Props = {
  channelId?: string;
  canManage?: boolean;
};

export function ChannelCommandMenu({ channelId, canManage }: Props) {
  const { t } = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("room.command.search")} />
      <CommandList>
        <CommandEmpty>{t("room.command.empty")}</CommandEmpty>
        <CommandGroup heading={t("room.command.navigate")}>
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="h-4 w-4" />
            {t("nav.dashboard")}
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          {channelId ? (
            <>
              <CommandItem onSelect={() => go(`/channel/${channelId}?tab=chat`)}>
                <MessageSquare className="h-4 w-4" />
                {t("room.command.roomChat")}
              </CommandItem>
              <CommandItem onSelect={() => go(`/channel/${channelId}?tab=player`)}>
                <Radio className="h-4 w-4" />
                {t("room.command.listenPlaylist")}
              </CommandItem>
              <CommandItem onSelect={() => go(`/channel/${channelId}?tab=queue`)}>
                <ListMusic className="h-4 w-4" />
                {t("room.admin.playlist.queue")}
              </CommandItem>
              <CommandItem onSelect={() => go(`/channel/${channelId}?tab=suggestions`)}>
                <Sparkles className="h-4 w-4" />
                {t("room.admin.nav.suggestions")}
              </CommandItem>
              {canManage ? (
                <CommandItem onSelect={() => go(`/channel/${channelId}?tab=admin`)}>
                  <Settings2 className="h-4 w-4" />
                  {t("room.admin.tab.admin.title")}
                </CommandItem>
              ) : null}
            </>
          ) : (
            <CommandItem onSelect={() => go("/join")}>
              <Search className="h-4 w-4" />
              {t("room.command.joinChannel")}
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
