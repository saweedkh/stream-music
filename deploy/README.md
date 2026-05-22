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

---

یک دستور برای بالا آوردن کل استک روی سرور مرکزی:

```bash
chmod +x deploy/up.sh deploy/down.sh deploy/lib/detect-primary-ip.sh
cp deploy/env.production.example .env.production
# ویرایش: SECRET_KEY و POSTGRES_PASSWORD (اجباری)

./deploy/up.sh
```

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
