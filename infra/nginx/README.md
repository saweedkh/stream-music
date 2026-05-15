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

## Phone: “SSL certificate error” when enabling push

Web Push registers a **Service Worker** (`/sw.js`). Phones are **stricter** than laptops: clicking “Proceed” on the site is **not enough** — the OS must **trust** the self-signed certificate.

1. On the phone (same Wi‑Fi), open **HTTP** (not HTTPS):
   `http://<LAN-IP>:8080/dev-ssl.crt`
   Example: `http://172.20.10.2:8080/dev-ssl.crt`

2. Install the downloaded profile/certificate:
   - **iPhone:** Settings → **Profile Downloaded** (or General → VPN & Device Management) → Install → then **Settings → General → About → Certificate Trust Settings** → enable full trust for *stream-music-dev*.
   - **Android:** Settings → Security → Encryption & credentials → **Install a certificate** → CA certificate → pick the file.

3. Close Safari/Chrome completely, reopen:
   `https://<LAN-IP>:8443`
   Accept any remaining browser warning once.

4. Dashboard → **Enable push** again.

If it still fails, regenerate the cert with your **current** LAN IP and restart nginx:

```bash
cd infra/nginx
LAN_IP=$(ipconfig getifaddr en0) ./generate-dev-certs.sh
docker compose restart nginx
```

**Alternative (easier long-term):** use [mkcert](https://github.com/FiloSottile/mkcert) on the Mac, copy `rootCA.pem` to the phone and install it, then generate certs with `mkcert 172.20.10.2 localhost 127.0.0.1` into `infra/nginx/ssl/` as `dev.crt` / `dev.key`.
