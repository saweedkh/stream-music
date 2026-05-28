const PRIVATE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_PATH_RE = /^\/join\/private\/([0-9a-f-]{36})$/i;
const PUBLIC_PATH_RE = /^\/join\/public\/([a-zA-Z0-9-]+)$/i;

/**
 * Normalize QR / pasted text into a short value for `joinChannelFromLink`
 * (invite UUID, public slug/code, or `/join?link=…` — not numeric room id).
 */
export function extractJoinInputFromScannedText(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  if (typeof window !== "undefined") {
    try {
      const u = new URL(t, window.location.origin);
      const pm = u.pathname.match(PRIVATE_PATH_RE);
      if (pm) return pm[1].toLowerCase();
      const pub = u.pathname.match(PUBLIC_PATH_RE);
      if (pub) return pub[1];
      if (u.pathname === "/join") {
        const l = u.searchParams.get("link");
        if (l) return extractJoinInputFromScannedText(decodeURIComponent(l));
      }
    } catch {
      // ignore
    }
  }

  try {
    if (t.startsWith("http://") || t.startsWith("https://")) {
      const u = new URL(t);
      const pm = u.pathname.match(PRIVATE_PATH_RE);
      if (pm) return pm[1].toLowerCase();
      const pub = u.pathname.match(PUBLIC_PATH_RE);
      if (pub) return pub[1];
      if (u.pathname === "/join" || u.pathname.endsWith("/join")) {
        const l = u.searchParams.get("link");
        if (l) return extractJoinInputFromScannedText(decodeURIComponent(l));
      }
    }
  } catch {
    // ignore
  }

  const withSlash = t.startsWith("/") ? t : `/${t}`;
  const pm2 = withSlash.match(PRIVATE_PATH_RE);
  if (pm2) return pm2[1].toLowerCase();
  const pub2 = withSlash.match(PUBLIC_PATH_RE);
  if (pub2) return pub2[1];

  if (PRIVATE_UUID_RE.test(t)) return t.toLowerCase();

  return t;
}
