/** Extract title/artist/album/duration from an audio File when possible. */

export type ParsedAudioMeta = {
  title?: string;
  artist?: string;
  album?: string;
  duration_seconds?: number;
};

export async function parseAudioFileMetadata(file: File): Promise<ParsedAudioMeta> {
  const base: ParsedAudioMeta = {
    title: file.name.replace(/\.[^/.]+$/, "").trim() || undefined,
  };
  try {
    const { parseBlob } = await import("music-metadata-browser");
    const meta = await parseBlob(file);
    const common = meta.common;
    return {
      title: common.title?.trim() || base.title,
      artist: common.artist?.trim() || common.artists?.[0]?.trim(),
      album: common.album?.trim(),
      duration_seconds: meta.format.duration ? Math.round(meta.format.duration * 10) / 10 : undefined,
    };
  } catch {
    return base;
  }
}
