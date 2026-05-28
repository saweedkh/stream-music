#!/usr/bin/env bash
# Scaffold a frontend feature module. Usage: ./tooling/scripts/new-feature.sh <slug>
set -euo pipefail

NAME="${1:?Usage: new-feature.sh <slug>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FEATURE_DIR="$ROOT/apps/web/src/features/$NAME"

if [[ -d "$FEATURE_DIR" ]]; then
  echo "Feature already exists: $FEATURE_DIR" >&2
  exit 1
fi

PASCAL="$(echo "$NAME" | sed -r 's/(^|-)([a-z])/\U\2/g')"

mkdir -p "$FEATURE_DIR/components" "$FEATURE_DIR/hooks" "$FEATURE_DIR/model" "$FEATURE_DIR/__tests__"

cat > "$FEATURE_DIR/index.ts" <<EOF
/**
 * ${PASCAL} feature — public API.
 * Import from \`@/features/${NAME}\` only.
 */

// export { ${PASCAL}Page } from "./${NAME}-page";
EOF

cat > "$FEATURE_DIR/${NAME}-page.tsx" <<EOF
"use client";

export function ${PASCAL}Page() {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      ${PASCAL} — implement in features/${NAME}/
    </div>
  );
}
EOF

touch "$FEATURE_DIR/model/.gitkeep"
touch "$FEATURE_DIR/__tests__/.gitkeep"

echo "Created feature: apps/web/src/features/${NAME}/"
echo "  - ${NAME}-page.tsx"
echo "  - components/ hooks/ model/ __tests__/"
echo "  - index.ts"
echo ""
echo "Next: wire a route in src/app/ and export ${PASCAL}Page from index.ts"
