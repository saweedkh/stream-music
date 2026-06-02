/** Client-side fetch of direct audio URLs (bypasses server download when CORS allows). */

const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|flac|aac|webm|opus)(\?.*)?$/i;

const STREAMING_HOST =
  /(^|\.)((youtube\.com)|(youtu\.be)|(soundcloud\.com)|(open\.spotify\.com)|(play\.spotify\.com))$/i;

export function isStreamingPlatformUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return STREAMING_HOST.test(host);
  } catch {
    return false;
  }
}

export function isLikelyDirectAudioUrl(url: string): boolean {
  if (isStreamingPlatformUrl(url)) return false;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return AUDIO_EXT.test(parsed.pathname);
  } catch {
    return false;
  }
}

function filenameFromUrl(url: string): string {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "audio.mp3");
    return base || "audio.mp3";
  } catch {
    return "audio.mp3";
  }
}

/** Download via browser (subject to CORS). Throws on failure. */
export async function fetchDirectAudioUrlAsFile(
  url: string,
  options?: { onProgress?: (percent: number) => void },
): Promise<File> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.onprogress = (event) => {
      if (!event.lengthComputable || !options?.onProgress) return;
      const pct = Math.min(90, Math.round((event.loaded / event.total) * 90));
      options.onProgress(pct);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("client_fetch_failed"));
        return;
      }
      const blob = xhr.response as Blob;
      if (!blob?.size) {
        reject(new Error("empty_file"));
        return;
      }
      const name = filenameFromUrl(url);
      const type = blob.type && blob.type.startsWith("audio/") ? blob.type : "audio/mpeg";
      options?.onProgress?.(95);
      resolve(new File([blob], name, { type }));
    };
    xhr.onerror = () => reject(new Error("client_fetch_failed"));
    xhr.ontimeout = () => reject(new Error("download_timeout"));
    xhr.timeout = 600_000;
    xhr.send();
  });
}
