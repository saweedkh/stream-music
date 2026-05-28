export type ChannelPlaybackEventPayload = {
  action?: string;
  event_seq?: number;
  is_playing?: boolean;
  started_at_server_time?: number | null;
  position?: number | null;
  track_file?: string | null;
  queue_version?: number;
  playlist_id?: number;
  playlist_name?: string;
  queue_index?: number;
  queue_length?: number;
  start_index?: number;
  server_time?: number;
};

/** Apply a server playback event to local sync fields (pure — easy to test). */
export function mergePlaybackPayload(
  prev: {
    isPlaying: boolean;
    startedAt: number | null | undefined;
    pausedAt: number | null | undefined;
    trackPath: string | undefined;
    queueVersion: number;
  },
  payload: ChannelPlaybackEventPayload,
): typeof prev {
  const action = String(payload.action ?? "").toLowerCase();
  const next = { ...prev };

  if (typeof payload.is_playing === "boolean") {
    next.isPlaying = payload.is_playing;
  }
  if ("started_at_server_time" in payload) {
    next.startedAt = payload.started_at_server_time ?? null;
  }
  if ("track_file" in payload) {
    next.trackPath = payload.track_file ?? undefined;
  }
  if (typeof payload.queue_version === "number") {
    next.queueVersion = payload.queue_version;
  }

  const hasPosition = "position" in payload && typeof payload.position === "number";
  if (hasPosition) {
    const pos = Math.max(0, payload.position as number);
    const playing = typeof payload.is_playing === "boolean" ? payload.is_playing : next.isPlaying;
    if (
      action === "pause" ||
      action === "initial_sync" ||
      playing === false ||
      action === "seek"
    ) {
      next.pausedAt = pos;
    }
  }

  return next;
}

export function shouldApplyEventSeq(
  lastSeq: number,
  payload: ChannelPlaybackEventPayload,
  action: string,
): { apply: boolean; nextSeq: number } {
  if (action === "initial_sync") {
    const seq = typeof payload.event_seq === "number" ? payload.event_seq : lastSeq;
    return { apply: true, nextSeq: Math.max(lastSeq, seq) };
  }
  const seq = typeof payload.event_seq === "number" ? payload.event_seq : null;
  if (seq === null) return { apply: true, nextSeq: lastSeq };
  if (seq <= lastSeq) return { apply: false, nextSeq: lastSeq };
  return { apply: true, nextSeq: seq };
}
