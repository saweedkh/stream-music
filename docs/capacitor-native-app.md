# Native app (Capacitor)

Stream Music ships as a PWA; Capacitor wraps the **hosted Next.js app** in a native WebView (recommended for App Router — no static export required).

## Setup

```bash
cd apps/web
npm install
# Point the WebView at your dev server (use LAN IP for physical devices)
export CAPACITOR_SERVER_URL=http://192.168.1.10:3000
npm run dev   # in another terminal

npx cap add android   # once
npx cap add ios       # once (macOS + Xcode)
npm run cap:sync
npm run cap:android   # or cap:ios
```

Production: set `CAPACITOR_SERVER_URL` to your public HTTPS origin (e.g. `https://stream.example.com`).

## Project files

| Path | Purpose |
|------|---------|
| `apps/web/capacitor.config.ts` | App id, `server.url`, splash/status bar |
| `apps/web/capacitor-www/` | Placeholder `webDir` (real UI loads from `server.url`) |
| `apps/web/src/lib/capacitor-runtime.ts` | `isCapacitorNative()`, status bar + splash hide |
| `apps/web/src/components/capacitor/capacitor-bootstrap.tsx` | Mounted in root layout |

## Behaviour

- PWA install banner is hidden on native.
- Web Push VAPID keys work in WebView when notification permission is granted.
- Background audio follows OS policies — test on real devices.

## Android notes

- `android/app/src/main/AndroidManifest.xml`: `INTERNET`, audio focus (Capacitor defaults).
- Emulator: use `http://10.0.2.2:3000` as `CAPACITOR_SERVER_URL` to reach host `localhost:3000`.

## iOS notes

- Allow arbitrary loads / ATS exceptions for `http://` dev URLs in `Info.plist` if needed.
- Safe areas: player shell already uses `env(safe-area-inset-bottom)`.
