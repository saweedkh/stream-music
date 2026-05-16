"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = [
  {
    title: "Listen together",
    body: "Playback is synced to the server clock — everyone hears the same moment.",
  },
  {
    title: "Vote & chat",
    body: "React in the room, vote to skip, and @mention friends in channel chat.",
  },
  {
    title: "Queue & playlists",
    body: "DJs control the queue. Play from a playlist to keep the night moving.",
  },
] as const;

const STORAGE_KEY = "stream-music:onboarding-v1";

export function RoomOnboarding({ channelId }: { channelId: string }) {
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

  const current = STEPS[step];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{current?.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{current?.body}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={finish}>
            Skip
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={finish}>
              Got it
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
