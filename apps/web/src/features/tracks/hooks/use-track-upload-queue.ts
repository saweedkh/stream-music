"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { importTrackFromUrl, uploadTrackChunked, type TrackSummary } from "@/lib/api";
import { parseAudioFileMetadata, type ParsedAudioMeta } from "@/lib/audio-metadata";
import {
  fetchDirectAudioUrlAsFile,
  isLikelyDirectAudioUrl,
} from "@/features/tracks/model/client-url-import";
import { uploadTrackResumable } from "@/lib/resumable-upload";
import {
  deriveTitleFromFileName,
  type UploadQueueItem,
  UPLOAD_CONCURRENCY,
} from "@/features/tracks/model/upload-types";

type UseTrackUploadQueueOptions = {
  onItemComplete?: (item: UploadQueueItem, track: TrackSummary) => void;
  onItemFailed?: (item: UploadQueueItem, message: string) => void;
  onBatchSettled?: () => void;
};

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

type EnqueueEntry = {
  kind: "file" | "url";
  file?: File;
  url?: string;
  title: string;
  artist?: string;
  album?: string;
};

export function useTrackUploadQueue({ onItemComplete, onItemFailed, onBatchSettled }: UseTrackUploadQueueOptions) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const itemsRef = useRef(items);
  const runningRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const uploadOne = useCallback(
    async (item: UploadQueueItem) => {
      updateItem(item.id, { status: "uploading", progress: 1, error: undefined });
      try {
        if (item.kind === "url" && item.url) {
          if (isLikelyDirectAudioUrl(item.url)) {
            try {
              const file = await fetchDirectAudioUrlAsFile(item.url, {
                onProgress: (p) => updateItem(item.id, { progress: p }),
              });
              const track = await uploadTrackResumable(
                uploadTrackChunked,
                {
                  title: item.title,
                  artist: item.artist,
                  album: item.album,
                  genre: item.genre,
                  visibility: item.visibility,
                  file,
                },
                { onProgress: (p) => updateItem(item.id, { progress: p }) },
              );
              updateItem(item.id, { status: "done", progress: 100, trackId: track.id });
              onItemComplete?.({ ...item, status: "done", progress: 100, trackId: track.id }, track);
              return;
            } catch {
              /* CORS or network — fall back to server import */
            }
          }
          const track = await importTrackFromUrl(
            {
              url: item.url,
              title: item.title,
              visibility: item.visibility,
              artist: item.artist,
              album: item.album,
              genre: item.genre,
            },
            { onProgress: (p) => updateItem(item.id, { progress: p }) },
          );
          const status = track.duplicate ? "duplicate" : "done";
          updateItem(item.id, { status, progress: 100, trackId: track.id });
          onItemComplete?.({ ...item, status, progress: 100, trackId: track.id }, track);
          return;
        }
        if (!item.file) throw new Error("missing_file");
        const track = await uploadTrackResumable(
          uploadTrackChunked,
          {
            title: item.title,
            artist: item.artist,
            album: item.album,
            genre: item.genre,
            visibility: item.visibility,
            file: item.file,
          },
          { onProgress: (p) => updateItem(item.id, { progress: p }) },
        );
        updateItem(item.id, { status: "done", progress: 100, trackId: track.id });
        onItemComplete?.({ ...item, status: "done", progress: 100, trackId: track.id }, track);
      } catch (error) {
        const raw = error instanceof Error ? error.message : "import_failed";
        const { localizeMessage } = await import("@/lib/i18n/localize-message");
        const message = localizeMessage(raw);
        updateItem(item.id, { status: "failed", error: message, progress: 0 });
        onItemFailed?.(item, message);
      }
    },
    [onItemComplete, onItemFailed, updateItem],
  );

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    try {
      while (true) {
        const snapshot = itemsRef.current;
        const active = snapshot.filter((i) => i.status === "uploading").length;
        const slots = UPLOAD_CONCURRENCY - active;
        if (slots <= 0) {
          await new Promise((r) => setTimeout(r, 120));
          continue;
        }
        const next = snapshot.filter((i) => i.status === "queued").slice(0, slots);
        if (next.length === 0) {
          const pending = snapshot.some((i) => i.status === "uploading");
          if (!pending) break;
          await new Promise((r) => setTimeout(r, 120));
          continue;
        }
        await Promise.all(next.map((item) => uploadOne(item)));
      }
    } finally {
      runningRef.current = false;
      setIsRunning(false);
      onBatchSettled?.();
    }
  }, [onBatchSettled, uploadOne]);

  const enqueueEntries = useCallback(
    async (entries: EnqueueEntry[], visibility: TrackSummary["visibility"]) => {
      if (!entries.length) return;
      const queued: UploadQueueItem[] = entries.map((entry) => {
        let title = entry.title.trim();
        if (!title) {
          if (entry.kind === "file" && entry.file) title = deriveTitleFromFileName(entry.file.name);
          else if (entry.url) {
            try {
              title = deriveTitleFromFileName(new URL(entry.url).pathname.split("/").pop() || "Imported track");
            } catch {
              title = "Imported track";
            }
          } else {
            title = "Untitled track";
          }
        }
        return {
          id: newId(),
          kind: entry.kind,
          file: entry.file,
          url: entry.url?.trim(),
          title,
          artist: entry.artist,
          album: entry.album,
          visibility,
          status: "queued" as const,
          progress: 0,
        };
      });
      setItems((prev) => {
        const next = [...prev, ...queued];
        itemsRef.current = next;
        return next;
      });
      queueMicrotask(() => void pump());
    },
    [pump],
  );

  const enqueueFiles = useCallback(
    async (files: File[], visibility: TrackSummary["visibility"]) => {
      if (!files.length) return;
      const entries: UploadQueueItem[] = [];
      for (const file of files) {
        const meta = await parseAudioFileMetadata(file).catch((): Partial<ParsedAudioMeta> => ({}));
        entries.push({
          id: newId(),
          kind: "file",
          file,
          title: meta.title ?? deriveTitleFromFileName(file.name),
          artist: meta.artist,
          album: meta.album,
          visibility,
          status: "queued",
          progress: 0,
        });
      }
      setItems((prev) => {
        const next = [...prev, ...entries];
        itemsRef.current = next;
        return next;
      });
      queueMicrotask(() => void pump());
    },
    [pump],
  );

  const enqueueUrl = useCallback(
    (url: string, visibility: TrackSummary["visibility"], title?: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      let derived = title?.trim() ?? "";
      if (!derived) {
        try {
          const path = new URL(trimmed).pathname;
          derived = deriveTitleFromFileName(path.split("/").pop() || "Remote track");
        } catch {
          derived = "Remote track";
        }
      }
      const entry: UploadQueueItem = {
        id: newId(),
        kind: "url",
        url: trimmed,
        title: derived,
        visibility,
        status: "queued",
        progress: 0,
      };
      setItems((prev) => {
        const next = [...prev, entry];
        itemsRef.current = next;
        return next;
      });
      queueMicrotask(() => void pump());
    },
    [pump],
  );

  const retryItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, status: "queued" as const, progress: 0, error: undefined } : item,
        );
        itemsRef.current = next;
        return next;
      });
      queueMicrotask(() => void pump());
    },
    [pump],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status === "queued" || item.status === "uploading"));
  }, []);

  const stats = {
    total: items.length,
    queued: items.filter((i) => i.status === "queued").length,
    uploading: items.filter((i) => i.status === "uploading").length,
    done: items.filter((i) => i.status === "done" || i.status === "duplicate").length,
    failed: items.filter((i) => i.status === "failed").length,
  };

  return {
    items,
    isRunning,
    stats,
    enqueueEntries,
    enqueueFiles,
    enqueueUrl,
    retryItem,
    removeItem,
    clearFinished,
  };
}
