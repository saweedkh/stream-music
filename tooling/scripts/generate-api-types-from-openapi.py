#!/usr/bin/env python3
"""Generate TypeScript path constants and operation map from openapi.snapshot.json."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "apps/web/src/lib/api/openapi.snapshot.json"
OUT_PATHS = ROOT / "apps/web/src/lib/api/types/schema-paths.ts"
OUT_OPS = ROOT / "apps/web/src/lib/api/types/openapi-operations.ts"


def _path_to_type(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "Param", path)


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
    OUT_PATHS.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_PATHS}")

    op_lines = [
        "/** Auto-generated operation keys (METHOD path) — do not edit by hand. */",
        "export const OPENAPI_OPERATIONS = {",
    ]
    for path, item in sorted(data.get("paths", {}).items()):
        if not isinstance(item, dict):
            continue
        for method in ("get", "post", "patch", "put", "delete"):
            if method in item:
                key = f"{method.upper()} {path}"
                op_lines.append(f'  "{key}": "{key}",')
    op_lines.append("} as const;")
    op_lines.append("")
    op_lines.append("export type OpenApiOperation = keyof typeof OPENAPI_OPERATIONS;")
    op_lines.append("")
    OUT_OPS.write_text("\n".join(op_lines), encoding="utf-8")
    print(f"Wrote {OUT_OPS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
