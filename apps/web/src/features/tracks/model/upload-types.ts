export type UploadQueueStatus = "queued" | "uploading" | "done" | "failed" | "duplicate";

export type UploadQueueItem = {
  id: string;
  kind: "file" | "url";
  file?: File;
  url?: string;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  visibility: import("@/lib/api").TrackSummary["visibility"];
  status: UploadQueueStatus;
  progress: number;
  error?: string;
  trackId?: number;
};

export const UPLOAD_CONCURRENCY = 3;

export function deriveTitleFromFileName(name: string): string {
  return name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
