# Realtime Contract Notes

This document freezes the current baseline contracts used by clients before feature expansion.

## Playback WebSocket (`/ws/channels/{id}`)

Core event payload keys (additive-only policy):

- `type` (uppercase event type)
- `action` (lowercase event action)
- `event_seq` (monotonic sequence)
- `channel_id`
- `server_time`
- `started_at_server_time`
- `position`
- `is_playing`
- `queue_version`
- `track_file`

Reserved initial sync action:

- `action: "initial_sync"` with optional `track`, `queue`, `experience`, `brand_logo_url`, `pending_count` (staff only)

Suggestion badge updates:

- `type: "SUGGESTIONS_UPDATED"` / `action: "suggestions_updated"` with `pending_count`, optional `event` (`created`|`updated`), `actor_username`

Latency ping:

- Client sends `action: "PING_LATENCY"` + `client_ts`
- Server responds with `type: "PONG_LATENCY"` + `client_ts` + `server_time`

## Chat WebSocket (`/ws/channels/{id}/chat`)

Event envelope:

- `type: "CHAT_EVENT"`
- `event` (e.g. `"message"`)
- `channel_id`
- `message` (chat message payload)

Sync/history messages:

- `type: "CHAT_SYNC"` with `messages`
- `type: "CHAT_HISTORY"` with `messages`
- `type: "CHAT_PURGED"`
- `type: "CHAT_ERROR"` with `code`

## HTTP Contract Baseline

- `GET /api/channels/{id}/state` returns:
  - `channel` (serialized channel)
  - `playback` (serialized playback session)

## Support WebSocket (`/ws/support/tickets/{ticket_id}`)

Access: ticket requester or support staff. Internal messages are filtered for non-staff clients.

Initial sync on connect:

- `type: "SUPPORT_SYNC"` with `ticket_id`, `ticket`, `messages`

Client actions (JSON):

- `{ "action": "send", "body": "...", "is_internal": false }`
- `{ "action": "read", "message_id": null | number }`
- `{ "action": "patch_ticket", "status"?, "priority"?, "assigned_to_id"?, "category"? }` (staff only)
- `{ "action": "history", "before"?: message_id, "limit"?: number }`

Server events:

- `type: "SUPPORT_EVENT"`, `event: "message"` with `message`, `ticket`
- `type: "SUPPORT_EVENT"`, `event: "ticket"` with `ticket`
- `type: "SUPPORT_HISTORY"` with `messages`
- `type: "SUPPORT_ERROR"` with `code`

## Support Staff Inbox WebSocket (`/ws/support/inbox`)

Access: support staff only.

Initial sync on connect:

- `type: "SUPPORT_INBOX_SYNC"` with `stats`

Live updates:

- `type: "SUPPORT_INBOX"` with `ticket` (row snapshot for inbox list)

Compatibility rules for all future phases:

1. Existing keys must not be removed or renamed.
2. New fields must be optional/additive.
3. New actions/events must not change meaning of existing actions.
