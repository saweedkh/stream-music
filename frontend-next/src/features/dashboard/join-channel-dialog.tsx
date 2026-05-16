"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { JoinQrCameraScanner } from "@/features/dashboard/join-qr-camera-scanner";
import { joinChannelFromLink } from "@/lib/api";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";
import { Camera, LogIn } from "lucide-react";

export function JoinChannelDialog() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const onQrDecoded = useCallback(
    (value: string) => {
      setLink(extractJoinInputFromScannedText(value));
      setCameraOpen(false);
      showToast("QR read — you can join or edit the field.", "success");
    },
    [showToast],
  );

  async function handleJoin() {
    if (!link.trim()) {
      showToast("Paste an invite code, public code, or join link.", "error");
      return;
    }
    setBusy(true);
    try {
      const normalized = extractJoinInputFromScannedText(link.trim());
      const out = await joinChannelFromLink(normalized);
      setLink("");
      if (out.status === "pending") {
        showToast("Join request sent. Wait for a channel moderator to approve.", "info");
        setOpen(false);
        return;
      }
      setOpen(false);
      showToast("Joined channel.", "success");
      router.push(`/channel/${out.channel}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not join channel.";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCameraOpen(false);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5 border-brand/50 text-brand hover:bg-[var(--brand-subtle)]">
          <LogIn className="h-4 w-4" aria-hidden />
          Join channel
        </Button>
      </DialogTrigger>
      <DialogContent className={cameraOpen ? "sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>Join a channel</DialogTitle>
          <DialogDescription>
            Paste an <strong className="text-foreground">invite code</strong> (UUID), a <strong className="text-foreground">public join code</strong>,
            or a full join URL. QR scan fills this automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {cameraOpen ? (
            <JoinQrCameraScanner
              onDecoded={onQrDecoded}
              onCancel={() => {
                setCameraOpen(false);
              }}
            />
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="join-channel-link">Join code</Label>
                <Input
                  id="join-channel-link"
                  placeholder="Invite code, public code, or paste join link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && handleJoin()}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={() => {
                  setCameraOpen(true);
                }}
              >
                <Camera className="h-4 w-4" aria-hidden />
                Scan QR with camera
              </Button>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleJoin} disabled={busy || !link.trim() || cameraOpen}>
            {busy ? "Joining…" : "Go to channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
