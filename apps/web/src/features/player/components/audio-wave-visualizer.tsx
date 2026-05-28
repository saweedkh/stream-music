"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const ACCENT: Record<string, { stroke: string; glow: string }> = {
  violet: { stroke: "#a78bfa", glow: "rgba(167, 139, 250, 0.45)" },
  rose: { stroke: "#fb7185", glow: "rgba(251, 113, 133, 0.4)" },
  amber: { stroke: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)" },
  sky: { stroke: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)" },
  emerald: { stroke: "#34d399", glow: "rgba(52, 211, 153, 0.45)" },
};

type GraphEntry = {
  ctx: AudioContext;
  source: AudioNode;
  analyser: AnalyserNode;
  refCount: number;
  /** `stream` taps captureStream without hijacking element output; legacy `element` routed all audio via Web Audio. */
  mode: "stream" | "element";
};

function captureMediaStream(media: HTMLMediaElement): MediaStream | null {
  const el = media as HTMLMediaElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
  try {
    if (typeof el.captureStream === "function") return el.captureStream();
    if (typeof el.mozCaptureStream === "function") return el.mozCaptureStream();
  } catch {
    /* ignore */
  }
  return null;
}

function createAnalyserGraph(media: HTMLMediaElement, variant: "full" | "compact"): GraphEntry | undefined {
  const ctx = getSharedAudioContext();
  if (!ctx) return undefined;

  const stream = captureMediaStream(media);
  if (stream) {
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = variant === "compact" ? 512 : 1024;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      void ctx.resume().catch(() => {});
      return { ctx, source, analyser, refCount: 0, mode: "stream" };
    } catch {
      return undefined;
    }
  }

  return undefined;
}

const graphByMedia = new WeakMap<HTMLMediaElement, GraphEntry>();
const teardownTimers = new WeakMap<HTMLMediaElement, ReturnType<typeof setTimeout>>();

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioContext?.state === "closed") sharedAudioContext = null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioContext();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

/** Resume Web Audio after a user gesture (autoplay / unlock). */
export function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (!ctx || ctx.state === "running") return Promise.resolve();
  return ctx.resume().catch(() => {});
}

/** True when legacy element-routing left audio on a suspended AudioContext (stream tap does not block output). */
export function isMediaOutputSuspended(media: HTMLMediaElement | null): boolean {
  if (!media) return false;
  const entry = graphByMedia.get(media);
  if (!entry || entry.mode === "stream") return false;
  return entry.ctx.state === "suspended";
}

function cancelTeardown(media: HTMLMediaElement) {
  const t = teardownTimers.get(media);
  if (t) {
    clearTimeout(t);
    teardownTimers.delete(media);
  }
}

function scheduleGraphTeardown(media: HTMLMediaElement) {
  cancelTeardown(media);
  const id = setTimeout(() => {
    teardownTimers.delete(media);
    const g = graphByMedia.get(media);
    if (!g || g.refCount > 0) return;
    try {
      g.source.disconnect();
      g.analyser.disconnect();
    } catch {
      /* ignore */
    }
    graphByMedia.delete(media);
  }, 400);
  teardownTimers.set(media, id);
}

type Props = {
  /** Channel playback `<audio>` element. */
  media: HTMLAudioElement | null;
  isActive: boolean;
  accent: string;
  className?: string;
  /** Thinner line + less glow for the bottom dock strip. */
  variant?: "full" | "compact";
};

/**
 * Realtime waveform via Web Audio `AnalyserNode` (time domain).
 * Falls back to a soft fake wave if the graph cannot be created (e.g. CORS).
 */
export function AudioWaveVisualizer({ media, isActive, accent, className, variant = "full" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const isActiveRef = useRef(isActive);
  const accentKeyRef = useRef((accent || "emerald").toLowerCase());
  const phaseRef = useRef(0);

  isActiveRef.current = isActive;
  accentKeyRef.current = (accent || "emerald").toLowerCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !media) {
      analyserRef.current = null;
      dataRef.current = null;
      return;
    }

    cancelTeardown(media);

    let existing = graphByMedia.get(media);
    if (!existing) {
      existing = createAnalyserGraph(media, variant);
      if (existing) graphByMedia.set(media, existing);
    }

    if (existing) {
      existing.refCount += 1;
      analyserRef.current = existing.analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(existing.analyser.frequencyBinCount));
    } else {
      analyserRef.current = null;
      dataRef.current = null;
    }

    const resume = () => {
      const g = graphByMedia.get(media);
      void g?.ctx.resume().catch(() => {});
    };
    media.addEventListener("play", resume);

    let raf = 0;

    const pal = () => ACCENT[accentKeyRef.current] ?? ACCENT.emerald;

    const draw = () => {
      const ctx2 = canvas.getContext("2d");
      const wrapEl = wrapRef.current;
      if (!ctx2 || !wrapEl) {
        raf = window.requestAnimationFrame(draw);
        return;
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = wrapEl.clientWidth;
      const ch = wrapEl.clientHeight;
      if (cw < 2 || ch < 2) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
      }

      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, cw, ch);

      const active = isActiveRef.current;
      const { stroke, glow } = pal();
      const mid = ch / 2;
      const compact = variant === "compact";
      const lineW = compact ? 1.25 : 2;
      const ampScale = compact ? ch * 0.36 : ch * 0.4;

      const a = analyserRef.current;
      const data = dataRef.current;
      if (active && a && data && data.length === a.frequencyBinCount) {
        a.getByteTimeDomainData(data as Parameters<AnalyserNode["getByteTimeDomainData"]>[0]);
        ctx2.lineJoin = "round";
        ctx2.lineCap = "round";
        ctx2.lineWidth = lineW;
        ctx2.strokeStyle = stroke;
        ctx2.shadowColor = glow;
        ctx2.shadowBlur = compact ? 6 : 14;
        ctx2.beginPath();
        const step = Math.max(1, Math.floor(data.length / cw));
        let px = 0;
        for (let x = 0; x < cw; x += 1) {
          const i = Math.min(data.length - 1, Math.floor(px));
          px += step;
          const v = (data[i]! - 128) / 128;
          const y = mid + v * ampScale;
          if (x === 0) ctx2.moveTo(x, y);
          else ctx2.lineTo(x, y);
        }
        ctx2.stroke();
        ctx2.shadowBlur = 0;

        ctx2.beginPath();
        px = 0;
        for (let x = 0; x < cw; x += 1) {
          const i = Math.min(data.length - 1, Math.floor(px));
          px += step;
          const v = (data[i]! - 128) / 128;
          const y = mid - v * ampScale * 0.55;
          if (x === 0) ctx2.moveTo(x, y);
          else ctx2.lineTo(x, y);
        }
        ctx2.strokeStyle = `${stroke}99`;
        ctx2.lineWidth = lineW * 0.65;
        ctx2.stroke();
      } else if (active) {
        phaseRef.current += compact ? 0.11 : 0.09;
        const t = phaseRef.current;
        ctx2.lineWidth = lineW;
        ctx2.strokeStyle = stroke;
        ctx2.shadowColor = glow;
        ctx2.shadowBlur = compact ? 5 : 10;
        ctx2.beginPath();
        for (let x = 0; x < cw; x += 1) {
          const wave =
            Math.sin(x * 0.045 + t * 1.4) * 0.42 +
            Math.sin(x * 0.11 + t * 2.1) * 0.22 +
            Math.sin(x * 0.022 + t * 0.7) * 0.18;
          const y = mid + wave * ampScale;
          if (x === 0) ctx2.moveTo(x, y);
          else ctx2.lineTo(x, y);
        }
        ctx2.stroke();
        ctx2.shadowBlur = 0;
      }

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      media.removeEventListener("play", resume);
      window.cancelAnimationFrame(raf);
      analyserRef.current = null;
      dataRef.current = null;

      const g = graphByMedia.get(media);
      if (g) {
        g.refCount -= 1;
        if (g.refCount <= 0) {
          scheduleGraphTeardown(media);
        }
      }
    };
  }, [media, variant]);

  return (
    <div ref={wrapRef} className={cn("relative min-h-[1px] min-w-[1px]", className)} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
