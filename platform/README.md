# Platform

Infrastructure and deployment assets (no product logic).

| Path | Purpose |
|------|---------|
| `deploy/` | Production scripts, env templates, edge-proxy |
| `infra/` | Nginx templates and TLS helpers |
| `scripts/` | Backup, E2E runners, VAPID key generation |

Root symlinks `deploy/`, `infra/`, and `scripts/` point here for backward compatibility.
