# Shared frontend modules

Cross-feature UI and hooks (no product-domain logic).

| Path | Contents |
|------|----------|
| `ui/` | Radix/shadcn primitives |
| `layout/` | App shell, nav, workspace chrome |
| `hooks/` | WebSocket, presence, hotkeys |
| `providers/` | Locale, theme, design system |
| `notifications/` | Notification center |
| `room/` | Room chrome, command menu, onboarding |
| `pwa/` | Install banner |

Import via `@/shared/<area>/...`.

Legacy `@/components/ui`, `@/components/layout`, `@/components/providers`, etc. still resolve under `shared/`.
