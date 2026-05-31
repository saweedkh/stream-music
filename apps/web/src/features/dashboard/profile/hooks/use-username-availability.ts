"use client";

import { useEffect, useState } from "react";
import { isUsernameFormatValid, normalizeUsername } from "@/features/dashboard/profile/model/username";
import { checkUsernameAvailable } from "@/lib/api";

export type UsernameAvailabilityStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unchanged";

export function useUsernameAvailability(currentUsername: string, nextUsername: string) {
  const [status, setStatus] = useState<UsernameAvailabilityStatus>("idle");

  useEffect(() => {
    const normalized = normalizeUsername(nextUsername);
    const current = normalizeUsername(currentUsername);

    if (!normalized || normalized === current) {
      setStatus(normalized === current && current ? "unchanged" : "idle");
      return;
    }

    if (!isUsernameFormatValid(normalized)) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    const timer = window.setTimeout(() => {
      void checkUsernameAvailable(normalized)
        .then((result) => setStatus(result.available ? "available" : "taken"))
        .catch(() => setStatus("idle"));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [currentUsername, nextUsername]);

  const canUseUsername =
    status === "unchanged" || status === "available" || (status === "idle" && normalizeUsername(nextUsername) === normalizeUsername(currentUsername));

  return { status, canUseUsername };
}
