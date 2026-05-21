"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { isCapacitorNative } from "@/lib/capacitor-runtime";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "stream-pwa-install-dismissed";

export function PwaInstallBanner() {
  const { t } = useTranslations();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCapacitorNative()) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = isIos && !/crios|fxios/i.test(ua);
    if (isSafari) setIosHint(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    if (isSafari) setVisible(true);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label={t("pwa.installTitle")}
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-lg rounded-xl border border-brand/30 bg-card/95 p-4 shadow-lg backdrop-blur-md sm:left-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{t("pwa.installTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {iosHint && !deferred ? t("pwa.iosHint") : t("pwa.installBody")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deferred ? (
              <Button type="button" size="sm" onClick={() => void install()}>
                {t("pwa.installAction")}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
              {t("pwa.dismiss")}
            </Button>
          </div>
        </div>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={dismiss} aria-label={t("pwa.dismiss")}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
