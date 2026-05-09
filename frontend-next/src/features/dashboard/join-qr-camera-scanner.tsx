"use client";

import type { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";

type Props = {
  onDecoded: (value: string) => void;
  onCancel: () => void;
};

function getCameraPrereqError(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) {
    return "Camera is blocked: this page uses HTTP with a non-localhost address. Browsers only allow the camera on HTTPS (or http://localhost). Use HTTPS on your server, open the app on localhost on the same device, or paste the invite in the field above.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not expose the camera API.";
  }
  return null;
}

export function JoinQrCameraScanner({ onDecoded, onCancel }: Props) {
  const regionId = useRef(`join-scan-${typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())}`).current;
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;
  const html5Ref = useRef<Html5Qrcode | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const prereq = getCameraPrereqError();
    if (prereq) {
      setError(prereq);
      setStarting(false);
    }

    if (prereq) {
      return () => {};
    }

    let cancelled = false;
    let settled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const html5 = new Html5Qrcode(regionId, false);
        html5Ref.current = html5;

        const qrConfig = { fps: 10, qrbox: { width: 220, height: 220 } as const, aspectRatio: 1 as const };
        const onScan = (decodedText: string) => {
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
        };

        try {
          await html5.start({ facingMode: "environment" }, qrConfig, onScan, () => {});
        } catch {
          const devices = await Html5Qrcode.getCameras();
          if (cancelled || devices.length === 0) throw new Error("No camera found.");
          await html5.start(devices[0].id, qrConfig, onScan, () => {});
        }

        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not use the camera.";
          const hint =
            msg.includes("Permission") || msg.includes("NotAllowed")
              ? " Allow camera access in the browser site settings."
              : "";
          setError(msg + hint);
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
