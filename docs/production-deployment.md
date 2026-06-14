# راه‌اندازی پروداکشن (Docker — سرور مرکزی)

این سند نصب کامل استک **Stream Music** برای محیط پروداکشن را شرح می‌دهد: PostgreSQL، Redis، Django (Daphne + Channels)، Next.js (standalone)، و **nginx** برای HTTPS (گواهی Certbot روی host) و پروکسی معکوس.

برای راهنمای کوتاه اسکریپت‌ها، [`deploy/README.md`](../deploy/README.md) را هم ببینید.

---

## ۱. معماری پروداکشن

| سرویس | نقش |
|--------|-----|
| **postgres** | پایگاه داده — فقط روی شبکه داخلی Docker |
| **redis** | Channels layer و کش |
| **backend** | API، WebSocket؛ فایل مدیا روی پوشهٔ host (پیش‌فرض `./media` → `/media` در کانتینر) |
| **frontend** | Next.js با خروجی `standalone` — پورت ۳۰۰۰ فقط داخلی |
| **nginx** | پورت‌های **۸۰**، **۴۴۳**، **۸۴۴۳**، **۸۰۸۰**؛ TLS از `/etc/letsencrypt`؛ مسیر `/api`، `/ws`، `/audio`، و بقیه |

کلاینت همیشه با همان **origin** صفحه به API وصل می‌شود؛ نیازی به `NEXT_PUBLIC_API_URL` جدا برای مرورگر نیست.

---

## ۲. پیش‌نیازها روی سرور

- **Docker Engine** و **Docker Compose V2** (مثلاً `docker compose version`).
- حداقل چند گیگابایت RAM برای بیلد فرانت و اجرای همزمان سرویس‌ها.
- برای HTTPS:
  - گواهی **Certbot** روی host (مثلاً `/etc/letsencrypt/live/saweedkh.ir/`).
  - رکورد **DNS** دامنه به IP سرور؛ پورت‌های **۸۰** و **۴۴۳** باز.

---

## ۳. تفاوت با محیط توسعه

| مورد | توسعه (`docker-compose.yml`) | پروداکشن (`docker-compose.prod.yml`) |
|------|------------------------------|--------------------------------------|
| کد روی دیسک | با volume به‌روز می‌شود | داخل ایمیج bake شده |
| فرانت | `npm run dev` | `next build` + `node server.js` |
| TLS | اختیاری nginx محلی :۸۴۴۳ | nginx پروداکشن :۴۴۳ (Certbot) |
| ورود یک دستور | دستی چند سرویس | `./deploy/up.sh` |

---

## ۴. اولین استقرار (گام‌به‌گام)

### ۴.۱ کلون و دسترسی اجرا

```bash
git clone https://github.com/saweedkh/stream-music.git
cd stream-music
chmod +x deploy/up.sh deploy/down.sh deploy/lib/detect-primary-ip.sh \
  deploy/render-env-generated.sh deploy/render-nginx-prod.sh
```

### ۴.۲ فایل محیط پروداکشن

الگو را کپی کنید و مقادیر را پر کنید:

```bash
cp deploy/env.production.example .env.production
nano .env.production   # یا vim / هر ویرایشگر
```

**اجباری قبل از `./deploy/up.sh`:**

- **`SECRET_KEY`**: یک رشته تصادفی طولانی (مثلاً خروجی `openssl rand -hex 32`). مقدار نمونهٔ حاوی `change-me` پذیرفته نمی‌شود.
- **`POSTGRES_PASSWORD`**: رمز قوی برای کاربر PostgreSQL تعریف‌شده در همان فایل.

بقیهٔ کلیدها در فایل نمونه توضیح داده شده‌اند؛ مقدار **`ALLOWED_HOSTS` در `.env.production`** می‌تواند پیش‌فرض باشد چون اسکریپت با **`deploy/.env.generated`** آن را با IP و دامنهٔ واقعی تکمیل می‌کند.

### ۴.۳ بالا آوردن استک

در `.env.production` حداقل `TLS_CERT_NAME` (نام پوشهٔ Certbot) را تنظیم کنید؛ برای دامنهٔ مرورگر `SITE_DOMAIN` را هم بگذارید:

```env
SITE_DOMAIN=music.saweedkh.ir
TLS_CERT_NAME=saweedkh.ir
```

```bash
./deploy/up.sh
```

اسکریپت این کارها را انجام می‌دهد:

1. تشخیص **IPv4 اصلی** ماشین (`deploy/lib/detect-primary-ip.sh`).
2. نوشتن **`deploy/.env.generated`** (شامل `ALLOWED_HOSTS`, `CORS_EXTRA_ORIGINS`, `PRIMARY_IP`, `PUBLIC_HOST`, در صورت امکان `DETECTED_PUBLIC_IPV4`).
3. نوشتن **`deploy/nginx.generated.conf`** (مسیرهای `fullchain.pem` / `privkey.pem` از Certbot).
4. ادغام **`.env.production` + `.env.generated`** در **`deploy/.env.runtime.merged`** (برای Compose و سرویس backend).
5. **`docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml up -d --build`**

آدرس پیشنهادی در خروجی اسکریپت چاپ می‌شود (مثلاً `https://music.example.com` یا `https://<IP>`).

---

## ۵. متغیرهای مهم `.env.production`

| متغیر | توضیح |
|--------|--------|
| `DEBUG` | برای پروداکشن باید `0` باشد. |
| `SECRET_KEY` | کلید Django؛ هرگز در Git قرار ندهید. |
| `POSTGRES_*` | اتصال به سرویس `postgres` در Compose؛ `POSTGRES_HOST=postgres` در compose برای backend ست شده است. |
| `REDIS_URL` | پیش‌فرض `redis://redis:6379/0`. |
| `MEDIA_ROOT` | درون کانتینر همیشه `/media` است. |
| `MEDIA_HOST_DIR` | مسیر روی host که به `/media` mount می‌شود (پیش‌فرض `./media`). |
| `CORS_EXTRA_ORIGINS` | در صورت نیاز به originهای اضافی؛ اسکریپت خودش بر اساس IP و دامنه مقدار می‌دهد. |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | با HTTPS روی `1` بمانند مگر TLS را جای دیگری خاتمه دهید. |
| `SITE_DOMAIN` | hostname مرورگر (باید با SAN گواهی هم‌خوان باشد). |
| `TLS_CERT_NAME` | نام پوشه زیر `/etc/letsencrypt/live/` (مثلاً `saweedkh.ir`). |
| `TLS_CERT_DIR` | پیش‌فرض `/etc/letsencrypt/live` (مسیر داخل کانتینر). |
| `TLS_CERT_HOST_DIR` | پیش‌فرض `/etc/letsencrypt` (mount به nginx). |

---

## ۶. TLS و DNS

### ۶.۱ گواهی Certbot روی host

- nginx فایل‌ها را از **`/etc/letsencrypt/live/<TLS_CERT_NAME>/`** می‌خواند (`fullchain.pem`, `privkey.pem`).
- بعد از `certbot renew`:  
  `docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml exec nginx nginx -s reload`

### ۶.۲ `SITE_DOMAIN` و SAN گواهی

- اگر کاربر `https://music.saweedkh.ir` باز می‌کند، گواهی باید آن subdomain را پوشش دهد (یا Certbot را با `-d music.saweedkh.ir` بگیرید).
- بدون `TLS_CERT_NAME` فقط **HTTP :8080** فعال است.

---

## ۷. فایل‌های تولیدشده (در Git نیستند)

طبق `.gitignore`:

- `deploy/.env.generated`
- `deploy/.env.runtime.merged` (شامل اسرار — هر بار با `./deploy/up.sh` بازسازی می‌شود)
- `deploy/nginx.generated.conf`

هر بار بعد از تغییر دامنه یا شبکه، دوباره **`./deploy/up.sh`** بزنید تا این فایل‌ها هماهنگ شوند.

---

## ۸. عملیات روزمره

### لاگ‌ها

```bash
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f backend
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f nginx
```

### ایجاد ادمین Django

```bash
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml exec backend \
  python manage.py createsuperuser
```

### توقف استک

```bash
./deploy/down.sh
```

یا:

```bash
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml down
```

### ورود موزیک از دیسک سرور

مثل محیط توسعه، فایل‌ها روی **دیسک سرور** در `MEDIA_HOST_DIR` (پیش‌فرض `./media`) ذخیره می‌شوند و داخل کانتینر در `/media` دیده می‌شوند. راهنمای CLI: [`docs/architecture.md`](architecture.md#import-ترک-از-دیسک).

---

## ۹. پشتیبان‌گیری و داده پایدار

ولوم‌های Docker:

| ولوم | محتوا |
|------|--------|
| `postgres_data` | دیتابیس |
| `./media` (یا `MEDIA_HOST_DIR`) | فایل‌های صوتی و مدیا روی host |
| (host) `/etc/letsencrypt` | گواهی TLS — mount به nginx |

برای بکاپ منظم از Postgres می‌توانید **`./scripts/backup.sh`** را اجرا کنید (خروجی در `backups/`). GitHub Actions workflow **`backup.yml`** هم روزانه بکاپ می‌گیرد.

### بازیابی (restore)

```bash
chmod +x scripts/restore-backup.sh
./scripts/restore-backup.sh backups/20260101-120000
```

اسکریپت Postgres و پوشهٔ مدia را از همان پوشهٔ بکاپ بازمی‌گرداند. قبل از restore ترافیک را قطع کنید.

### مهاجرت از ولوم Docker قدیمی (`media_data`)

اگر قبلاً از named volume استفاده می‌کردید، یک‌بار داده را به `./media` منتقل کنید:

```bash
mkdir -p media
docker run --rm \
  -v stream-music_media_data:/from:ro \
  -v "$(pwd)/media:/to" \
  alpine sh -c "cp -a /from/. /to/"
./deploy/up.sh
```

---

## ۱۰. import از لینک (YTDLP_PROXY)

YouTube، SoundCloud و Spotify روی **سرور** با yt-dlp پردازش می‌شوند. اگر شبکهٔ سرور به این سایت‌ها دسترسی ندارد (مثلاً فیلتر)، در `.env.production` تنظیم کنید:

```env
YTDLP_PROXY=http://HOST:PORT
```

پروکسی باید از داخل کانتینرهای `backend` و `celery-worker` قابل دسترس باشد (مثلاً VPN روی host با `http://172.17.0.1:7890`).

---

## ۱۱. حالت VPS (بدون mount زندهٔ کد)

برای سرور production واقعی (نه لپ‌تاپ LAN):

```bash
USE_VPS_COMPOSE=1 ./deploy/up.sh
```

این override (`docker-compose.prod.vps.yml`) mount `./apps/api` را حذف می‌کند — کد فقط داخل image است. بعد از تغییر Python: `./deploy/up.sh` (rebuild).

---

## ۱۲. مانیتورینگ و لاگ

| ابزار | کار |
|--------|-----|
| `deploy/smoke.sh` | بعد از deploy — health + صفحهٔ اصلی |
| `deploy/alert-health.sh` | برای cron — exit غیرصفر اگر API degraded |
| `deploy/logrotate-stream-music.conf` | نمونه rotate لاگ Docker |

مثال cron (هر ۵ دقیقه):

```bash
*/5 * * * * /root/stream-music/deploy/alert-health.sh || logger "stream-music health FAIL"
```

### Sentry (اختیاری)

در `.env.production`:

```env
SENTRY_DSN=https://…
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=https://…
```

---

## ۱۳. به‌روزرسانی نسخهٔ اپلیکیشن

```bash
git pull
./deploy/up.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
```

این دستور ایمیج‌ها را دوباره می‌سازد و کانتینرها را با نسخهٔ جدید بالا می‌آورد. قبل از pull در محیط حساس، در staging تست کنید.

پس از deploy ویژگی‌های اجتماعی/playback، در صورت نیاز بررسی کنید: `GET /api/metrics` (شامل `webpush.ready`)، `GET /api/me/channels-online`، `GET /api/channels/{id}/party-recap`.

---

## ۱۴. عیب‌یابی

| مشکل | اقدام |
|------|--------|
| خطای `POSTGRES_PASSWORD required` | مقدار در `.env.production` و سپس دوباره `./deploy/up.sh`. |
| خطای مربوط به `env.runtime.merged` | هرگز بدون اسکریپت Compose را با prod بالا نیاورید؛ اول `./deploy/up.sh`. |
| `ERR_SSL` / گواهی نامعتبر | مسیر Certbot، `TLS_CERT_NAME`، و تطابق `SITE_DOMAIN` با SAN گواهی. |
| CSRF / CORS | مطمئن شوید از همان آدرسی که در مرورگر باز کرده‌اید وارد می‌شوید؛ مقادیر `ALLOWED_HOSTS` و `CORS_EXTRA_ORIGINS` بعد از تغییر شبکه با اسکریپت بازتولید شوند. |
| import از لینک `download_failed` | `YTDLP_PROXY` در `.env.production`؛ یا آپلود فایل از دستگاه |
| وب‌سوکت قطع می‌شود | nginx مسیر `/ws/` را به backend پروکسی می‌کند؛ پشت CDN همهٔ ارائه‌دهندگان WS را پشتیبانی نمی‌کنند. |

---

## ۱۵. چک‌لیست امنیت پروداکشن

- `SECRET_KEY` و `POSTGRES_PASSWORD` منحصر به فرد و قوی.
- `.env.production` و `deploy/.env.runtime.merged` هرگز commit نشوند.
- `DEBUG=0`.
- در صورت نیاز، فایروال طوری باشد که فقط **۸۰/۴۴۳** از اینترنت باز باشند؛ PostgreSQL و Redis از بیرون در دسترس نباشند (در compose به میزبان publish نشده‌اند).

---

## ۱۶. CDN و فایل‌های صوتی (اختیاری)

برای ترافیک بالا:

- سرو فایل‌های `MEDIA_ROOT` از nginx با `Cache-Control` بلند یا origin CDN (Cloudflare، S3+CloudFront).
- WebSocket روی همان hostname API یا subdomain اختصاصی `wss://` با sticky session.
- PostgreSQL و Redis تک‌primary بمانند؛ replica فقط برای analytics در صورت نیاز.

پس از حذف/جایگزینی ترک، کش CDN را invalidate کنید.

---

## ۱۷. مرجع فایل‌ها

- `docker-compose.prod.yml` — تعریف سرویس‌های پروداکشن.
- `apps/api/Dockerfile.prod` — backend بدون mirror اجباری PyPI در Dockerfile توسعه.
- `apps/web/Dockerfile.prod` — بیلد npm از registry عمومی؛ خروجی standalone.
- `deploy/up.sh`, `deploy/down.sh` — ورود و خروج یکپارچه.
- `deploy/render-env-generated.sh`, `deploy/render-nginx-prod.sh` — تولید کانفیگ از IP، دامنه، و مسیر Certbot.
