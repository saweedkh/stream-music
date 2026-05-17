# Production deploy (Docker)

راهنمای **کامل** (معماری، TLS، عیب‌یابی، بکاپ): [`docs/production-deployment.md`](../docs/production-deployment.md).

یک دستور برای بالا آوردن کل استک روی سرور مرکزی:

```bash
chmod +x deploy/up.sh deploy/down.sh deploy/lib/detect-primary-ip.sh
cp deploy/env.production.example .env.production
# ویرایش: SECRET_KEY و POSTGRES_PASSWORD (اجباری)

./deploy/up.sh
```

## دو حالت TLS

1. **دامنه واقعی (پیشنهادی)** — سرتی Let's Encrypt خودکار (پورت‌های **۸۰ و ۴۴۳** باید از اینترنت به همین ماشین برسند):

   ```bash
   export SITE_DOMAIN=music.example.com
   ./deploy/up.sh
   ```

2. **فقط IP** — اگر `SITE_DOMAIN` ندهید، اسکریپت IP اصلی را تشخیص می‌دهد و Caddy با **`tls internal`** بالا می‌آید (مرورگر هشدار می‌دهد مگر CA را قبول کنید).

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
- `deploy/Caddyfile.generated`
