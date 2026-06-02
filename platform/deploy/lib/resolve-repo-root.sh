# Resolve monorepo root (contains docker-compose.prod.yml) from a deploy script path.
resolve_repo_root() {
  local start="${1:?}"
  local dir
  dir="$(cd "$(dirname "$start")" && pwd)"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "${dir}/docker-compose.prod.yml" && -d "${dir}/apps/api" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}
