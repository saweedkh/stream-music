# Production deploy (Docker)

راهنمای **کامل** (معماری، TLS، عیب‌یابی، بکاپ): [`docs/production-deployment.md`](../docs/production-deployment.md).

## آپدیت از لپ‌تاپ (بدون Git)

```bash
cp deploy/sync.env.example deploy/sync.env   # یک‌بار — host/user/password
chmod +x deploy/push.sh
./deploy/push.sh          # rsync + ./deploy/up.sh روی سرور (volumeها سالم می‌مانند)
./deploy/push.sh --dry-run   # فقط پیش‌نمایش
```

ترجیحاً `ssh-copy-id` بزنید و `SSH_PASSWORD` را خالی بگذارید. برای پسورد: `brew install hudochenkov/sshpass/sshpass`.

**مسیر سرور (ثابت):** `REMOTE_PATH=/root/stream-music` در `deploy/sync.env`.  
کد، `docker compose` و **`.env.production`** فقط همین‌جا خوانده می‌شوند — `/root/stream-music/.env.production`.

---

یک دستور برای بالا آوردن کل استک روی سرور مرکزی:

```bash
chmod +x deploy/up.sh deploy/down.sh deploy/lib/detect-primary-ip.sh
cp deploy/env.production.example .env.production
# ویرایش: SECRET_KEY و POSTGRES_PASSWORD (اجباری)

./deploy/up.sh
```

بعد از `up.sh` اسکریپت **`deploy/smoke.sh`** به‌صورت خودکار `/api/health` و صفحهٔ اصلی را چک می‌کند. دستی:

```bash
chmod +x deploy/smoke.sh
SMOKE_BASE_URL=http://127.0.0.1:8080 ./deploy/smoke.sh
```

**Healthcheck:** در `docker-compose.prod.yml` برای `postgres`، `redis`، `backend` و `celery-worker` تعریف شده — `docker compose ps` باید `healthy` نشان دهد.

**VPS (بدون mount زنده):** `USE_VPS_COMPOSE=1 ./deploy/up.sh` — کد API فقط داخل image.

**YTDLP_PROXY:** برای import از YouTube/Spotify روی شبکهٔ فیلترشده در `.env.production` تنظیم کنید (جزئیات در `docs/production-deployment.md`).

**مانیتورینگ:** `deploy/alert-health.sh` برای cron؛ `scripts/restore-backup.sh` برای بازیابی بکاپ.

**کد بک‌اند:** `apps/api` روی `backend` و `celery-*` **mount** می‌شود (مثل `docker-compose.yml` dev). بعد از تغییر Python فقط ری‌استارت کنید:

```bash
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml restart backend celery-worker celery-beat
```

فرانت هنوز داخل image ساخته می‌شود — برای UI باید `./deploy/up.sh` (build frontend) بزنید.

## TLS (nginx + Certbot روی host)

1. گواهی را روی سرور بگیرید (مثلاً `certbot certonly` → `/etc/letsencrypt/live/saweedkh.ir/`).
2. در `.env.production` تنظیم کنید:

   ```env
   SITE_DOMAIN=music.saweedkh.ir
   TLS_CERT_NAME=saweedkh.ir
   ```

3. `./deploy/up.sh` — nginx همان فایل‌های `fullchain.pem` / `privkey.pem` را mount می‌کند.

بدون `TLS_CERT_NAME` فقط **HTTP روی :8080** فعال است (بدون بلوک :443).

اسکریپت **`deploy/render-env-generated.sh`** مقدار **`ALLOWED_HOSTS`** و **`CORS_EXTRA_ORIGINS`** را از IP تشخیص‌شده + دامنه تکمیل می‌کند.

## Edge LAN (کش صوتی، کم‌کردن اینترنت)

اگر همکاران روی Wi‑Fi به لپ‌تاپ شما وصل می‌شوند و فقط یک خط اینترنت دارید:

**[`deploy/edge-proxy/README.md`](edge-proxy/README.md)**

```bash
cp deploy/edge-proxy/env.example deploy/edge-proxy/.env.edge
# UPSTREAM_URL = آدرس همین سرور مرکزی
./deploy/edge-proxy/up.sh
```

## توقف

```bash
./deploy/down.sh
```

## لاگ و عملیات متداول

```bash
docker compose --env-file deploy/.env.runtime.merged \
  -f docker-compose.prod.yml logs -f backend

docker compose --env-file deploy/.env.runtime.merged \
  -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

فایل‌های تولیدشده (دوباره با `./deploy/up.sh` ساخته می‌شوند):

- `deploy/.env.generated`
- `deploy/.env.runtime.merged` (ادغام `.env.production` + generated برای Compose و سرویس‌ها)
- `deploy/nginx.generated.conf`
