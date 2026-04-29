"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Music</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="space-y-1">
          <Label>Audio file</Label>
          <div
            className="rounded-md border border-dashed border-slate-600 bg-slate-950/70 p-4 text-center text-sm text-slate-300"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onTrackFileDrop(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            Drag and drop audio file here
          </div>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            type="file"
            accept="audio/*"
            onChange={(e) => onTrackFileChange(e.target.files?.[0] ?? null)}
          />
          {selectedTrackFileName ? <p className="text-xs text-slate-400">Selected file: {selectedTrackFileName}</p> : null}
          {errors.trackFile ? <p className="text-xs text-rose-400">{errors.trackFile}</p> : null}
        </div>
        <Button className="w-full" onClick={onUploadTrack} disabled={isUploading}>
          {isUploading ? `Uploading... ${uploadProgress}%` : "Upload"}
        </Button>
        <div className="space-y-1 text-xs text-slate-300">
          {tracks.map((track) => (
            <p key={track.id}>
              {track.title} - <span className="text-slate-500">{track.visibility}</span>
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
