# LAN Performance Test Plan

## Setup
- Run `docker compose up --build`.
- Open 3/10/30 browser clients on the same LAN.
- Join the same channel from all clients.

## Telemetry Collection
- Client emits `PING_LATENCY` every 5 seconds over WebSocket.
- Server stores playback events and timestamps per channel.
- Client logs `expectedTime - currentTime` drift every 3 seconds.

## Acceptance Targets
- Median sync error under `60ms`.
- P95 sync error under `100ms`.
- Admin control propagation under `150ms`.

## Mandatory Scenarios
- User joins in the middle of a playing track.
- Admin seeks while playback is active.
- Admin triggers `next`/`prev` repeatedly.
- A client disconnects and reconnects.
