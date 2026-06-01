/** Lifecycle helpers for a single channel HTMLAudioElement. */

export function createChannelAudio(): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "auto";
  audio.setAttribute("playsinline", "playsinline");
  audio.setAttribute("webkit-playsinline", "webkit-playsinline");
  audio.setAttribute("x-webkit-airplay", "allow");
  return audio;
}

export function haltChannelAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  try {
    audio.pause();
    audio.playbackRate = 1;
    audio.removeAttribute("src");
    audio.load();
  } catch {
    /* ignore */
  }
}

export function readPosition(audio: HTMLAudioElement): number {
  const t = audio.currentTime;
  return Number.isFinite(t) ? t : 0;
}

export function readDuration(audio: HTMLAudioElement): number {
  const d = audio.duration;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

export type LoadTrackResult = "ready" | "aborted" | "error";

export function loadChannelTrack(
  audio: HTMLAudioElement,
  src: string,
  isCurrentLoad: () => boolean,
): Promise<LoadTrackResult> {
  haltChannelAudio(audio);
  if (!isCurrentLoad()) return Promise.resolve("aborted");

  audio.src = src;
  audio.load();

  return new Promise((resolve) => {
    if (!isCurrentLoad()) {
      resolve("aborted");
      return;
    }

    const finish = (result: LoadTrackResult) => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("error", onError);
      resolve(result);
    };

    const onReady = () => finish(isCurrentLoad() ? "ready" : "aborted");
    const onMeta = () => {
      if (!isCurrentLoad()) finish("aborted");
      else if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) finish("ready");
    };
    const onError = () => finish(isCurrentLoad() ? "error" : "aborted");

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onMeta, { once: true });
    audio.addEventListener("error", onError, { once: true });

    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      finish(isCurrentLoad() ? "ready" : "aborted");
    }
  });
}

export type PlayResult = "playing" | "blocked" | "aborted";

export async function playChannelAudio(audio: HTMLAudioElement): Promise<PlayResult> {
  try {
    await audio.play();
    return "playing";
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "AbortError") return "aborted";
    return "blocked";
  }
}

export function seekChannelAudio(audio: HTMLAudioElement, seconds: number): void {
  const d = readDuration(audio);
  const max = d > 0 ? Math.max(0, d - 0.05) : Infinity;
  audio.currentTime = Math.min(Math.max(0, seconds), max);
}
