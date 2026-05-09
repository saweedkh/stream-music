/** Normalize QR text (URL or path) into a single string for `joinChannelFromLink`. */
export function extractJoinInputFromScannedText(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  const privatePathRe = /^\/join\/private\/([0-9a-f-]{36})$/i;

  if (typeof window !== "undefined") {
    try {
      const u = new URL(t, window.location.origin);
      const pm = u.pathname.match(privatePathRe);
      if (pm) return `/join/private/${pm[1]}`;
      if (u.pathname === "/join") {
        const c = u.searchParams.get("channel");
        if (c) return c.trim();
        const l = u.searchParams.get("link");
        if (l) return decodeURIComponent(l);
      }
    } catch {
      // ignore
    }
  }

  try {
    if (t.startsWith("http://") || t.startsWith("https://")) {
      const u = new URL(t);
      const path = u.pathname;
      const pm = path.match(privatePathRe);
      if (pm) return `/join/private/${pm[1]}`;
      if (path === "/join" || path.endsWith("/join")) {
        const c = u.searchParams.get("channel");
        if (c) return c.trim();
        const l = u.searchParams.get("link");
        if (l) return decodeURIComponent(l);
      }
    }
  } catch {
    // ignore
  }

  if (privatePathRe.test(t.startsWith("/") ? t : `/${t}`)) {
    const p = t.startsWith("/") ? t : `/${t}`;
    const pm = p.match(privatePathRe);
    if (pm) return `/join/private/${pm[1]}`;
  }

  return t;
}
