"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { TrackSummary } from "@/lib/api";

type Props = {
  tracks: TrackSummary[];
  trackTitle: string;
  trackVisibility: TrackSummary["visibility"];
  selectedTrackFileName?: string;
  isUploading: boolean;
  uploadProgress: number;
  errors: { trackTitle?: string; trackFile?: string };
  onTrackTitleChange: (value: string) => void;
  onTrackVisibilityChange: (value: TrackSummary["visibility"]) => void;
  onTrackFileChange: (file: File | null) => void;
  onTrackFileDrop: (file: File | null) => void;
  onUploadTrack: () => void;
};

export function TrackLibrarySection(props: Props) {
  const {
    tracks,
    trackTitle,
    trackVisibility,
    selectedTrackFileName,
    isUploading,
    uploadProgress,
    errors,
    onTrackTitleChange,
    onTrackVisibilityChange,
    onTrackFileChange,
    onTrackFileDrop,
    onUploadTrack,
  } = props;

  const visibilityTone: Record<TrackSummary["visibility"], "default" | "warning" | "success"> = {
    private: "default",
    shared_with_users: "warning",
    shared_with_channels: "warning",
    public_lan: "success",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="border-zinc-800/90">
        <CardHeader>
          <CardTitle className="text-lg">Upload</CardTitle>
          <CardDescription>Add audio to your library with visibility controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Track title</Label>
            <Input value={trackTitle} aria-invalid={Boolean(errors.trackTitle)} valid={Boolean(trackTitle.trim())} onChange={(e) => onTrackTitleChange(e.target.value)} />
            {errors.trackTitle ? <p className="text-xs text-rose-400">{errors.trackTitle}</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Visibility</Label>
            <Select value={trackVisibility} valid={Boolean(trackVisibility)} onChange={(e) => onTrackVisibilityChange(e.target.value as TrackSummary["visibility"])}>
              <option value="private">private</option>
              <option value="shared_with_users">shared_with_users</option>
              <option value="shared_with_channels">shared_with_channels</option>
              <option value="public_lan">public_lan</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Audio file</Label>
            <div
              className="rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/60 p-5 text-center text-sm text-zinc-400 transition hover:border-emerald-500/50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onTrackFileDrop(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              Drag and drop audio file here
            </div>
            <input
              className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-200 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200"
              type="file"
              accept="audio/*"
              onChange={(e) => onTrackFileChange(e.target.files?.[0] ?? null)}
            />
            {selectedTrackFileName ? <p className="text-xs text-zinc-500">Selected file: {selectedTrackFileName}</p> : null}
            {errors.trackFile ? <p className="text-xs text-rose-400">{errors.trackFile}</p> : null}
          </div>
          {isUploading ? (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-zinc-500">Uploading... {uploadProgress}%</p>
            </div>
          ) : null}
          <Button className="w-full" onClick={onUploadTrack} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload track"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-800/90">
        <CardHeader>
          <CardTitle className="text-lg">Library ({tracks.length})</CardTitle>
          <CardDescription>Everything you have uploaded.</CardDescription>
        </CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <p className="text-sm text-zinc-500">No tracks yet. Upload your first track.</p>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 transition-colors hover:border-zinc-700/90"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
                    <p className="text-xs text-zinc-500">Track #{track.id}</p>
                  </div>
                  <Badge variant={visibilityTone[track.visibility]}>{track.visibility}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
