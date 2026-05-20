/** Persist in-progress chunked uploads so they can resume after refresh or network blip. */

import type { TrackSummary } from "@/lib/api";

const STORAGE_KEY = "stream-music:chunk-upload";

export type PendingChunkUpload = {
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  written: number;
  title: string;
  artist?: string;
  album?: string;
  visibility: string;
  updatedAt: number;
};

export function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function loadPendingUpload(): PendingChunkUpload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingChunkUpload;
    if (!parsed?.uploadId || !parsed.fileKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingUpload(data: PendingChunkUpload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
}

export function clearPendingUpload(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export type ResumableTrackPayload = {
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  tags?: string[];
  visibility: TrackSummary["visibility"];
  file: File;
};

/** Wrap chunked upload with localStorage checkpoints for refresh/network recovery. */
export async function uploadTrackResumable<T extends { id: number }>(
  uploadFn: (
    payload: ResumableTrackPayload,
    options?: {
      onProgress?: (percent: number) => void;
      resumeUploadId?: string;
      startOffset?: number;
      onCheckpoint?: (info: { uploadId: string; written: number }) => void;
    },
  ) => Promise<T>,
  payload: ResumableTrackPayload,
  options?: { onProgress?: (percent: number) => void },
): Promise<T> {
  const fp = fileFingerprint(payload.file);
  let pending = loadPendingUpload();
  if (pending && pending.fileKey !== fp) {
    clearPendingUpload();
    pending = null;
  }

  const track = await uploadFn(payload, {
    onProgress: options?.onProgress,
    resumeUploadId: pending?.uploadId,
    startOffset: pending?.written,
    onCheckpoint: ({ uploadId, written }) => {
      savePendingUpload({
        uploadId,
        fileKey: fp,
        fileName: payload.file.name,
        fileSize: payload.file.size,
        fileLastModified: payload.file.lastModified,
        written,
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        visibility: payload.visibility,
        updatedAt: Date.now(),
      });
    },
  });
  clearPendingUpload();
  return track;
}
