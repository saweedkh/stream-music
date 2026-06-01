import { getApiBase, withAuthHeaders, withAuthFormData, extractApiError, ensureCsrfCookie, readCookie } from "./client";
import type { TrackSummary, PaginatedTracks, TrackSharePermission, TrackFacets } from "./types";

export const CHUNK_UPLOAD_THRESHOLD_BYTES = 2 * 1024 * 1024;
export const CHUNK_UPLOAD_PART_SIZE = 4 * 1024 * 1024;

export async function listTracks(options?: {
  search?: string;
  genre?: string;
  album?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  favorited?: boolean;
}): Promise<TrackSummary[] | PaginatedTracks> {
  const params = new URLSearchParams();
  const q = (options?.search ?? "").trim();
  if (q) params.set("search", q);
  if (options?.genre?.trim()) params.set("genre", options.genre.trim());
  if (options?.album?.trim()) params.set("album", options.album.trim());
  if (options?.tag?.trim()) params.set("tag", options.tag.trim());
  if (options?.limit != null && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.floor(options.limit)));
  }
  if (options?.offset != null && Number.isFinite(options.offset)) {
    params.set("offset", String(Math.floor(options.offset)));
  }
  if (options?.favorited) params.set("favorited", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/api/tracks/${suffix}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load tracks");
  const data = await res.json();
  if (Array.isArray(data)) return data as TrackSummary[];
  return data as PaginatedTracks;
}

export async function setTrackFavorite(trackId: number, favorited: boolean): Promise<{ is_favorited: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/favorite/`,
    await withAuthHeaders({ method: favorited ? "POST" : "DELETE", body: "{}" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update favorite"));
  return (await res.json()) as { is_favorited: boolean };
}

export async function deleteTrack(trackId: number) {
  const res = await fetch(`${getApiBase()}/api/tracks/${trackId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete track"));
}

export async function updateTrack(
  trackId: number,
  payload: { title?: string; artist?: string; album?: string; visibility?: TrackSummary["visibility"] },
) {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update track"));
  return (await res.json()) as TrackSummary;
}

export async function uploadTrack(
  payload: { title: string; artist?: string; album?: string; visibility: TrackSummary["visibility"]; file: File },
  options?: { onProgress?: (percent: number) => void; timeoutMs?: number },
) {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("artist", payload.artist ?? "");
  formData.append("album", payload.album ?? "");
  formData.append("visibility", payload.visibility);
  formData.append("file", payload.file);
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken") ?? "";

  return await new Promise<TrackSummary>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBase()}/api/tracks/`);
    xhr.withCredentials = true;
    xhr.timeout = options?.timeoutMs ?? 1000 * 60 * 20;
    xhr.setRequestHeader("X-CSRFToken", csrfToken);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options?.onProgress) return;
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as TrackSummary);
        } catch {
          reject(new Error("Upload succeeded but response parsing failed"));
        }
        return;
      }
      let message = "Cannot upload track";
      try {
        const body = JSON.parse(xhr.responseText) as { detail?: string } | Record<string, unknown>;
        if (typeof (body as { detail?: string }).detail === "string") {
          message = (body as { detail: string }).detail;
        }
      } catch {
        // keep fallback message
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading track"));
    xhr.ontimeout = () => reject(new Error("Upload timeout. Please retry with a stable connection."));
    xhr.send(formData);
  });
}

export async function uploadTrackChunked(
  payload: {
    title: string;
    artist?: string;
    album?: string;
    genre?: string;
    tags?: string[];
    visibility: TrackSummary["visibility"];
    file: File;
  },
  options?: {
    onProgress?: (percent: number) => void;
    resumeUploadId?: string;
    startOffset?: number;
    onCheckpoint?: (info: { uploadId: string; written: number }) => void;
  },
): Promise<TrackSummary> {
  const { file } = payload;
  if (file.size <= CHUNK_UPLOAD_THRESHOLD_BYTES) {
    return uploadTrack(payload, options);
  }
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken") ?? "";
  let upload_id = options?.resumeUploadId ?? "";
  let uploaded = options?.startOffset ?? 0;

  if (upload_id) {
    try {
      const st = await getChunkUploadStatus(upload_id);
      uploaded = Math.min(file.size, st.written);
    } catch {
      upload_id = "";
      uploaded = 0;
    }
  }

  if (!upload_id) {
    const initRes = await fetch(`${getApiBase()}/api/tracks/upload/init`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        title: payload.title,
        artist: payload.artist ?? "",
        album: payload.album ?? "",
        genre: payload.genre ?? "",
        tags: payload.tags ?? [],
        visibility: payload.visibility,
      }),
    });
    if (!initRes.ok) throw new Error(await extractApiError(initRes, "Cannot start upload"));
    const initBody = (await initRes.json()) as { upload_id: string; written?: number };
    upload_id = initBody.upload_id;
    uploaded = initBody.written ?? 0;
    options?.onCheckpoint?.({ uploadId: upload_id, written: uploaded });
  }

  while (uploaded < file.size) {
    const end = Math.min(uploaded + CHUNK_UPLOAD_PART_SIZE, file.size);
    const slice = file.slice(uploaded, end);
    const buf = await slice.arrayBuffer();
    const putRes = await fetch(`${getApiBase()}/api/tracks/upload/${upload_id}/chunk`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
        "Content-Type": "application/octet-stream",
      },
      body: buf,
    });
    if (!putRes.ok) throw new Error(await extractApiError(putRes, "Chunk upload failed"));
    const body = (await putRes.json()) as { written: number };
    uploaded = body.written;
    options?.onCheckpoint?.({ uploadId: upload_id, written: uploaded });
    options?.onProgress?.(Math.min(99, Math.round((uploaded / file.size) * 100)));
  }

  const finRes = await fetch(`${getApiBase()}/api/tracks/upload/${upload_id}/finalize`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
  });
  if (!finRes.ok) throw new Error(await extractApiError(finRes, "Cannot finalize upload"));
  options?.onProgress?.(100);
  const track = (await finRes.json()) as TrackSummary;
  return track;
}

export async function importTrackFromUrl(payload: {
  url: string;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  tags?: string[];
  visibility: TrackSummary["visibility"];
}): Promise<TrackSummary & { duplicate?: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/tracks/upload/from-url`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot import track from URL"));
  return (await res.json()) as TrackSummary & { duplicate?: boolean };
}

export async function getChunkUploadStatus(uploadId: string) {
  const res = await fetch(`${getApiBase()}/api/tracks/upload/${encodeURIComponent(uploadId)}/status`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot read upload status"));
  return (await res.json()) as {
    upload_id: string;
    written: number;
    size: number;
    filename?: string;
    title?: string;
    visibility?: string;
  };
}

export async function listTrackSharePermissions(trackId: number) {
  const res = await fetch(`${getApiBase()}/api/tracks/${trackId}/share-permissions`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load track share permissions");
  return (await res.json()) as { results: TrackSharePermission[] };
}

export async function addTrackSharePermission(trackId: number, payload: { user_id?: number; channel_id?: number }) {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/share-permissions`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error("Cannot add track share permission");
  return (await res.json()) as TrackSharePermission;
}

export async function removeTrackSharePermission(trackId: number, shareId: number) {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/share-permissions`,
    await withAuthHeaders({ method: "DELETE", body: JSON.stringify({ share_id: shareId }) }),
  );
  if (!res.ok) throw new Error("Cannot remove track share permission");
}

export async function getTrackFacets(): Promise<TrackFacets> {
  const res = await fetch(`${getApiBase()}/api/tracks/facets`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load facets");
  return (await res.json()) as TrackFacets;
}

export async function importTrackFromExternalUrl(
  url: string,
  options?: { async?: boolean },
): Promise<TrackSummary | { ok: boolean; status: string }> {
  const res = await fetch(
    `${getApiBase()}/api/tracks/import-external`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ url, async: options?.async ?? false }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Import failed"));
  return (await res.json()) as TrackSummary | { ok: boolean; status: string };
}
