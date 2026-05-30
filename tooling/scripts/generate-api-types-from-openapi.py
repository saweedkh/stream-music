#!/usr/bin/env python3
"""Generate TypeScript path constants from openapi.snapshot.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "apps/web/src/lib/api/openapi.snapshot.json"
OUT = ROOT / "apps/web/src/lib/api/types/schema-paths.ts"


def main() -> int:
    snapshot_path = Path(sys.argv[1]) if len(sys.argv) > 1 else SNAPSHOT
    data = json.loads(snapshot_path.read_text(encoding="utf-8"))
    paths = sorted(data.get("paths", {}).keys())
    lines = [
        "/** Auto-generated from openapi.snapshot.json — do not edit by hand. */",
        "export const OPENAPI_PATHS = [",
    ]
    for p in paths:
        lines.append(f'  "{p}",')
    lines.append("] as const;")
    lines.append("")
    lines.append("export type OpenApiPath = (typeof OPENAPI_PATHS)[number];")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
