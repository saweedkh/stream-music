/** Same-origin and API fallbacks for Django media (MEDIA_URL is typically `/audio/`). */
export function resolveMediaCandidates(url: string | null | undefined): string[] {
  const value = url?.trim();
  if (!value) return [];

  if (typeof window === "undefined") {
    return [value];
  }

  const out: string[] = [];

  try {
    const parsed = new URL(value, window.location.origin);
    out.push(parsed.toString());
    out.push(`${window.location.origin}${parsed.pathname}${parsed.search}`);
  } catch {
    out.push(value);
  }

  const path = value.startsWith("/") ? value : `/${value}`;
  if (path.startsWith("/audio/") || path.startsWith("/media/")) {
    const publicApi = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    if (publicApi) {
      out.push(`${publicApi}${path}`);
    }
    const { hostname, port } = window.location;
    const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalDev && port && port !== "8000" && port !== "8002") {
      out.push(`http://127.0.0.1:8000${path}`);
      out.push(`http://localhost:8000${path}`);
    }
  }

  return [...new Set(out)];
}

/** First candidate for simple img/src usage. */
export function resolveMediaSrc(url: string | null | undefined): string | undefined {
  return resolveMediaCandidates(url)[0];
}
