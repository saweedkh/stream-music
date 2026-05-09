# راه‌اندازی پروداکشن (Docker — سرور مرکزی)

این سند نصب کامل استک **Stream Music** برای محیط پروداکشن را شرح می‌دهد: PostgreSQL، Redis، Django (Daphne + Channels)، Next.js (standalone)، و **Caddy** برای HTTPS و پروکسی معکوس.

برای راهنمای کوتاه اسکریپت‌ها، [`deploy/README.md`](../deploy/README.md) را هم ببینید.

---

## ۱. معماری پروداکشن

| سرویس | نقش |
|--------|-----|
| **postgres** | پایگاه داده — فقط روی شبکه داخلی Docker |
| **redis** | Channels layer و کش |
| **backend** | API، WebSocket، فایل مدیا روی ولوم `media_data` |
| **frontend** | Next.js با خروجی `standalone` — پورت ۳۰۰۰ فقط داخلی |
| **caddy** | پورت‌های **۸۰** و **۴۴۳** عمومی؛ TLS؛ مسیر `/api`، `/ws`، `/audio`، و بقیه به فرانت |

کلاینت همیشه با همان **origin** صفحه به API وصل می‌شود؛ نیازی به `NEXT_PUBLIC_API_URL` جدا برای مرورگر نیست.

---

## ۲. پیش‌نیازها روی سرور

- **Docker Engine** و **Docker Compose V2** (مثلاً `docker compose version`).
- حداقل چند گیگابایت RAM برای بیلد فرانت و اجرای همزمان سرویس‌ها.
- برای HTTPS واقعی با دامنه:
  - رکورد **DNS A** (یا AAAA) دامنه به IP عمومی همین سرور.
  - پورت‌های **۸۰** و **۴۴۳** باز به این ماشین (برای چالش Let's Encrypt).

---

## ۳. تفاوت با محیط توسعه

| مورد | توسعه (`docker-compose.yml`) | پروداکشن (`docker-compose.prod.yml`) |
|------|------------------------------|--------------------------------------|
| کد روی دیسک | با volume به‌روز می‌شود | داخل ایمیج bake شده |
| فرانت | `npm run dev` | `next build` + `node server.js` |
| TLS | اختیاری nginx محلی :۸۴۴۳ | Caddy روی :۴۴۳ |
| ورود یک دستور | دستی چند سرویس | `./deploy/up.sh` |

---

## ۴. اولین استقرار (گام‌به‌گام)

### ۴.۱ کلون و دسترسی اجرا

```bash
git clone https://github.com/saweedkh/stream-music.git
cd stream-music
chmod +x deploy/up.sh deploy/down.sh deploy/lib/detect-primary-ip.sh \
  deploy/render-env-generated.sh deploy/render-caddyfile.sh
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

**بدون دامنه (فقط IP، گواهی خودامضای Caddy):**

```bash
./deploy/up.sh
```

**با دامنه و Let's Encrypt خودکار:**

```bash
export SITE_DOMAIN=music.example.com
./deploy/up.sh
```

اسکریپت این کارها را انجام می‌دهد:

1. تشخیص **IPv4 اصلی** ماشین (`deploy/lib/detect-primary-ip.sh`).
2. نوشتن **`deploy/.env.generated`** (شامل `ALLOWED_HOSTS`, `CORS_EXTRA_ORIGINS`, `PRIMARY_IP`, `PUBLIC_HOST`, در صورت امکان `DETECTED_PUBLIC_IPV4`).
3. نوشتن **`deploy/Caddyfile.generated`** (دامنه → HTTPS خودکار؛ بدون دامنه → `tls internal`).
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
| `MEDIA_ROOT` | درون کانتینر معمولاً `/media` و با ولوم `media_data` یکسان است. |
| `CORS_EXTRA_ORIGINS` | در صورت نیاز به originهای اضافی؛ اسکریپت خودش بر اساس IP و دامنه مقدار می‌دهد. |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | با HTTPS روی `1` بمانند مگر TLS را جای دیگری خاتمه دهید. |

متغیر **`SITE_DOMAIN`** در shell قبل از `up.sh` ست می‌شود، نه لزوماً داخل `.env.production`.

---

## ۶. TLS و DNS

### ۶.۱ حالت دامنه (`SITE_DOMAIN`)

- Caddy به‌صورت پیش‌فرض برای نام عمومی، گواهی **Let's Encrypt** می‌گیرد.
- باید **۸۰** و **۴۴۳** از اینترنت به همین سرور برسند و DNS درست باشد.

### ۶.۲ حالت فقط IP

- در **`deploy/render-caddyfile.sh`** از **`tls internal`** استفاده می‌شود؛ مرورگر هشدار امنیتی نشان می‌دهد مگر گواهی را به‌صورت دستی اعتماد دهید.
- برای استفادهٔ واقعی کاربران، حالت دامنه توصیه می‌شود.

---

## ۷. فایل‌های تولیدشده (در Git نیستند)

طبق `.gitignore`:

- `deploy/.env.generated`
- `deploy/.env.runtime.merged` (شامل اسرار — هر بار با `./deploy/up.sh` بازسازی می‌شود)
- `deploy/Caddyfile.generated`

هر بار بعد از تغییر دامنه یا شبکه، دوباره **`./deploy/up.sh`** بزنید تا این فایل‌ها هماهنگ شوند.

---

## ۸. عملیات روزمره

### لاگ‌ها

```bash
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f backend
docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f caddy
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

مثل محیط توسعه، داخل کانتینر backend؛ مسیر مدیا روی ولوم **`media_data`** persist می‌شود. راهنمای CLI: [`docs/import-audio-cli.md`](import-audio-cli.md).

---

## ۹. پشتیبان‌گیری و داده پایدار

ولوم‌های Docker:

| ولوم | محتوا |
|------|--------|
| `postgres_data` | دیتابیس |
| `media_data` | فایل‌های صوتی و مدیا |
| `caddy_data`, `caddy_config` | گواهی‌ها و پیکربندی Caddy |

برای بکاپ منظم از Postgres می‌توانید دوره‌ای **`pg_dump`** از داخل کانتینر `postgres` بگیرید یا کل ولوم را snapshot کنید.

---

## ۱۰. به‌روزرسانی نسخهٔ اپلیکیشن

```bash
git pull
./deploy/up.sh
```

این دستور ایمیج‌ها را دوباره می‌سازد و کانتینرها را با نسخهٔ جدید بالا می‌آورد. قبل از pull در محیط حساس، در staging تست کنید.

---

## ۱۱. عیب‌یابی

| مشکل | اقدام |
|------|--------|
| خطای `POSTGRES_PASSWORD required` | مقدار در `.env.production` و سپس دوباره `./deploy/up.sh`. |
| خطای مربوط به `env.runtime.merged` | هرگز بدون اسکریپت Compose را با prod بالا نیاورید؛ اول `./deploy/up.sh`. |
| لیست‌بوک Let's Encrypt | DNS، فایروال ۸۰/۴۴۳، و صحت `SITE_DOMAIN`. |
| CSRF / CORS | مطمئن شوید از همان آدرسی که در مرورگر باز کرده‌اید وارد می‌شوید؛ مقادیر `ALLOWED_HOSTS` و `CORS_EXTRA_ORIGINS` بعد از تغییر شبکه با اسکریپت بازتولید شوند. |
| وب‌سوکت قطع می‌شود | Caddy مسیر `/ws/` را به backend پروکسی می‌کند؛ پشت CDN همهٔ ارائه‌دهندگان WS را پشتیبانی نمی‌کنند. |

---

## ۱۲. چک‌لیست امنیت پروداکشن

- `SECRET_KEY` و `POSTGRES_PASSWORD` منحصر به فرد و قوی.
- `.env.production` و `deploy/.env.runtime.merged` هرگز commit نشوند.
- `DEBUG=0`.
- در صورت نیاز، فایروال طوری باشد که فقط **۸۰/۴۴۳** از اینترنت باز باشند؛ PostgreSQL و Redis از بیرون در دسترس نباشند (در compose به میزبان publish نشده‌اند).

---

## ۱۳. مرجع فایل‌ها

- `docker-compose.prod.yml` — تعریف سرویس‌های پروداکشن.
- `backend-django/Dockerfile.prod` — backend بدون mirror اجباری PyPI در Dockerfile توسعه.
- `frontend-next/Dockerfile.prod` — بیلد npm از registry عمومی؛ خروجی standalone.
- `deploy/up.sh`, `deploy/down.sh` — ورود و خروج یکپارچه.
- `deploy/render-env-generated.sh`, `deploy/render-caddyfile.sh` — تولید کانفیگ از IP و دامنه.
