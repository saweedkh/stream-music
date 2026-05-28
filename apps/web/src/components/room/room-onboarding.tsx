"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "stream-music:onboarding-v1";

const STEP_KEYS = [
  { title: "room.onboarding.step1.title" as const, body: "room.onboarding.step1.body" as const },
  { title: "room.onboarding.step2.title" as const, body: "room.onboarding.step2.body" as const },
  { title: "room.onboarding.step3.title" as const, body: "room.onboarding.step3.body" as const },
];

export function RoomOnboarding({ channelId }: { channelId: string }) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const key = `${STORAGE_KEY}:${channelId}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [channelId]);

  function finish() {
    localStorage.setItem(`${STORAGE_KEY}:${channelId}`, "1");
    setOpen(false);
  }

  const current = STEP_KEYS[step];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{current ? t(current.title) : null}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{current ? t(current.body) : null}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-xs text-muted-foreground">
          {t("common.stepOf", { current: step + 1, total: STEP_KEYS.length })}
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={finish}>
            {t("common.skip")}
          </Button>
          {step < STEP_KEYS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              {t("common.next")}
            </Button>
          ) : (
            <Button type="button" onClick={finish}>
              {t("common.gotIt")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
