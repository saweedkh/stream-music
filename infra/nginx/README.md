# Nginx (Docker): HTTP + optional HTTPS

## Quick start

1. Generate self-signed TLS (use your **real** LAN IP so phones trust the SAN):

   ```bash
   cd infra/nginx
   LAN_IP=192.168.x.x ./generate-dev-certs.sh
   ```

2. From repo root:

   ```bash
   docker compose up -d nginx
   ```

3. Open **HTTP**: `http://<LAN-IP>:8080`  
   **HTTPS** (camera / secure APIs): `https://<LAN-IP>:8443` — accept the browser warning once.

4. Django: set exact origin for CSRF, e.g. in `.env`:

   ```env
   CORS_EXTRA_ORIGINS=https://192.168.x.x:8443
   ```

   Then `docker compose restart backend`.

## If `https://…:8443` does not load

- Confirm TLS files exist: `infra/nginx/ssl/dev.crt` and `dev.key` (run `generate-dev-certs.sh`).
- Recreate nginx after certs: `docker compose up -d nginx` or `docker compose restart nginx`.
- On the Mac, test: `curl -vk https://127.0.0.1:8443` — if this fails, nginx or certs are wrong.
- From the phone, use the **same Wi‑Fi / hotspot** as the Mac; IP must be the Mac’s address (`ipconfig getifaddr en0` or Wi‑Fi details).
- Docker Desktop: ports are bound to `0.0.0.0` in `docker-compose.yml`. Allow incoming connections if macOS Firewall blocks Docker.

## Behaviour without certs

If `dev.crt` / `dev.key` are missing, nginx still serves **HTTP on :8080**; HTTPS on **:8443** is omitted until you generate certs and restart nginx.
