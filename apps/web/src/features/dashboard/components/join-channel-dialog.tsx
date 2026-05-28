"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { joinChannelFromLink } from "@/lib/api";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";
import { Camera, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const JoinQrCameraScanner = dynamic(
  () => import("@/features/dashboard/components/join-qr-camera-scanner").then((m) => m.JoinQrCameraScanner),
  {
    ssr: false,
    loading: () => <p className="text-xs text-muted-foreground">Starting camera…</p>,
  },
);

type JoinChannelDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerVariant?: "default" | "sidebar";
  className?: string;
  hideTrigger?: boolean;
};

export function JoinChannelDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  triggerVariant = "default",
  className,
  hideTrigger = false,
}: JoinChannelDialogProps) {
  const { t } = useTranslations();
  const router = useRouter();
  const { showToast } = useToast();
  const [openInternal, setOpenInternal] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const open = openProp !== undefined ? openProp : openInternal;

  function setOpen(next: boolean) {
    if (onOpenChangeProp) onOpenChangeProp(next);
    else setOpenInternal(next);
    if (!next) setCameraOpen(false);
  }

  const onQrDecoded = useCallback(
    (value: string) => {
      setLink(extractJoinInputFromScannedText(value));
      setCameraOpen(false);
      showToast(t("join.qrRead"), "success");
    },
    [showToast, t],
  );

  async function handleJoin() {
    if (!link.trim()) {
      showToast(t("join.pasteCode"), "error");
      return;
    }
    setBusy(true);
    try {
      const normalized = extractJoinInputFromScannedText(link.trim());
      const out = await joinChannelFromLink(normalized);
      setLink("");
      if (out.status === "pending") {
        showToast(t("join.pending"), "info");
        setOpen(false);
        return;
      }
      setOpen(false);
      showToast(t("join.success"), "success");
      router.push(`/channel/${out.channel}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("join.failed");
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant === "sidebar" ? "default" : "outline"}
            size={triggerVariant === "sidebar" ? "default" : "sm"}
            className={cn(
              triggerVariant === "sidebar"
                ? "h-10 w-full gap-2 bg-brand text-brand-foreground shadow-sm shadow-brand/20 hover:bg-brand-strong"
                : "shrink-0 gap-1.5 border-brand/50 text-brand hover:bg-[var(--brand-subtle)]",
              className,
            )}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {t("dashboard.joinChannel")}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className={cn(cameraOpen ? "sm:max-w-lg" : "sm:max-w-md", "max-h-[min(90dvh,40rem)] overflow-y-auto")}>
        <DialogHeader>
          <DialogTitle>{t("join.title")}</DialogTitle>
          <DialogDescription>{t("join.description")}</DialogDescription>
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
                <Label htmlFor="join-channel-link">{t("join.codeLabel")}</Label>
                <Input
                  id="join-channel-link"
                  placeholder={t("join.codePlaceholder")}
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
                {t("join.scanQr")}
              </Button>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("join.cancel")}
          </Button>
          <Button type="button" onClick={handleJoin} disabled={busy || !link.trim() || cameraOpen}>
            {busy ? t("join.submitting") : t("join.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
