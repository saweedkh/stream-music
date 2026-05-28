export type PlaybackState = {
  started_at_server_time: number | null;
  paused_at_position: number | null;
  is_playing: boolean;
  queue_version?: number;
  track?: { file?: string | null; title?: string | null } | null;
};
