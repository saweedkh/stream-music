"use client";

import { useEffect, useState } from "react";

const LG_QUERY = "(min-width: 1024px)";

function readLgUp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(LG_QUERY).matches;
}

/** Matches Tailwind `lg` breakpoint (1024px). */
export function useIsLgUp(): boolean {
  const [isLgUp, setIsLgUp] = useState(readLgUp);

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLgUp;
}
