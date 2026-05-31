#!/usr/bin/env bash
# Add Capacitor iOS/Android shells and patch iOS background audio mode.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/apps/web"

cd "$WEB"
if [[ ! -d ios ]]; then
  npx cap add ios
fi
if [[ ! -d android ]]; then
  npx cap add android
fi

PLIST="$WEB/ios/App/App/Info.plist"
if [[ -f "$PLIST" ]] && ! grep -q UIBackgroundModes "$PLIST"; then
  python3 - <<'PY' "$PLIST"
import plistlib, sys
path = sys.argv[1]
with open(path, "rb") as f:
    pl = plistlib.load(f)
modes = pl.get("UIBackgroundModes") or []
if "audio" not in modes:
    modes.append("audio")
    pl["UIBackgroundModes"] = modes
with open(path, "wb") as f:
    plistlib.dump(pl, f)
print("Patched UIBackgroundModes audio in", path)
PY
fi

npx cap sync
echo "Capacitor native projects ready under apps/web/ios and apps/web/android"
