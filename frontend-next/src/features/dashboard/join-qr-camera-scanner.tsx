"use client";

import type { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";

type Props = {
  onDecoded: (value: string) => void;
  onCancel: () => void;
};

export function JoinQrCameraScanner({ onDecoded, onCancel }: Props) {
  const regionId = useRef(`join-scan-${typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())}`).current;
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;
  const html5Ref = useRef<Html5Qrcode | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const html5 = new Html5Qrcode(regionId, false);
        html5Ref.current = html5;
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          (decodedText) => {
            if (settled || cancelled) return;
            const value = extractJoinInputFromScannedText(decodedText);
            if (!value) return;
            settled = true;
            void html5
              .stop()
              .then(() => html5.clear())
              .catch(() => {})
              .finally(() => {
                html5Ref.current = null;
                onDecodedRef.current(value);
              });
          },
          () => {},
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not use the camera.");
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const h = html5Ref.current;
      html5Ref.current = null;
      if (h) {
        void h.stop().then(() => h.clear()).catch(() => {});
      }
    };
  }, [regionId]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">Point the camera at a channel QR. The field will fill automatically.</p>
      {starting ? <p className="text-xs text-zinc-400">Starting camera…</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <div
        id={regionId}
        className="mx-auto w-full max-w-[280px] overflow-hidden rounded-lg border border-zinc-700 bg-black shadow-inner [&_video]:mx-auto [&_video]:max-h-[260px] [&_video]:w-full [&_video]:object-cover"
      />
      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onCancel}>
        Cancel camera
      </Button>
    </div>
  );
}
