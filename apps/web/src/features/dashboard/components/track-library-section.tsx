"use client";

import { useState } from "react";
import { TrackLibraryPanel, TrackUploadStudio } from "@/features/tracks";

type Props = {
  onUploadComplete?: () => void;
  resumeUploadBanner?: React.ReactNode;
};

export function TrackLibrarySection({ onUploadComplete, resumeUploadBanner }: Props) {
  const [refreshSignal, setRefreshSignal] = useState(0);

  function handleUploadComplete() {
    setRefreshSignal((n) => n + 1);
    onUploadComplete?.();
  }

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      {resumeUploadBanner}
      <TrackUploadStudio onUploadComplete={handleUploadComplete} />
      <TrackLibraryPanel refreshSignal={refreshSignal} />
    </div>
  );
}
