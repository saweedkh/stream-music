"use client";

import { Volume2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

type Props = {
  open: boolean;
  title: string;
  onEnable: () => void;
};

export function ChannelAudioUnlockDialog({ open, title, onEnable }: Props) {
  const { t } = useTranslations();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="z-[60] gap-5"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-brand"
            aria-hidden
          >
            <Volume2 className="h-7 w-7" />
          </div>
          <DialogTitle>{t("player.unlockTitle")}</DialogTitle>
          <DialogDescription>{t("player.unlockDescription")}</DialogDescription>
        </DialogHeader>
        {title ? (
          <p className="truncate text-center text-sm font-medium text-foreground" title={title}>
            {title}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-center">
          <Button type="button" size="lg" className="min-w-[12rem] gap-2" onClick={onEnable}>
            <Volume2 className="h-4 w-4" aria-hidden />
            {t("player.enableAudio")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
