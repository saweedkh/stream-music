# LAN Edge Proxy (کم‌کردن مصرف اینترنت)

یک **nginx سبک** روی لپ‌تاپ/مینی‌پی داخل شبکهٔ محلی که:

- به **سرور اصلی** (`UPSTREAM_URL`) وصل می‌شود
- مسیرهای `/api/`، `/ws/` و فرانت را **پروکسی** می‌کند
- فایل‌های **`/audio/`** را روی دیسک **کش** می‌کند

همکاران فقط `http://<IP-لن-شما>:9080/` را باز می‌کنند. اولین پخش هر آهنگ از اینترنت می‌آید؛ پخش‌های بعدی (و بقیهٔ LAN) از کش لوکال.

## پیش‌نیاز

- Docker روی ماشین edge
- سرور مرکزی از قبل با `./deploy/up.sh` بالا باشد
- اینترنت پایدار بین edge و upstream

## راه‌اندازی

```bash
chmod +x deploy/edge-proxy/up.sh deploy/edge-proxy/down.sh

cp deploy/edge-proxy/env.example deploy/edge-proxy/.env.edge
# ویرایش UPSTREAM_URL — همان آدرسی که مرورگر به سرور اصلی می‌زند

./deploy/edge-proxy/up.sh
```

خروجی اسکریپت آدرس LAN را چاپ می‌کند (مثلاً `http://192.168.1.50:9080/`).

## تنظیمات (`.env.edge`)

| متغیر | معنی |
|--------|------|
| `UPSTREAM_URL` | مبدأ سرور مرکزی، مثلاً `https://music.example.com` یا `http://203.0.113.10:8080` |
| `EDGE_PORT` | پورت روی ماشین LAN (پیش‌فرض `9080`) |
| `CACHE_MAX_SIZE` | سقف کش دیسکی (پیش‌فرض `50g`) |
| `CACHE_INACTIVE` | پاک‌سازی فایل‌های بدون استفاده (پیش‌فرض `30d`) |
| `PROXY_SSL_VERIFY` | `0` برای گواهی self-signed سرور (حالت IP + `tls internal`) |

## سرور مرکزی

روی سرور معمولاً همین کافی است (با `deploy/up.sh`):

- `TRUST_LAN_CSRF=1` — originهای خصوصی LAN برای CSRF/CORS
- اگر از edge با **HTTP** لاگین می‌کنید: `SESSION_COOKIE_SECURE=0` و `CSRF_COOKIE_SECURE=0` در `.env.production` سرور

نیازی به اجرای stack کامل روی edge نیست — فقط همین nginx.

## عیب‌یابی

```bash
docker compose -f deploy/edge-proxy/docker-compose.yml logs -f
```

- هدر **`X-Cache-Status`**: `MISS` = از اینترنت؛ `HIT` = از کش LAN
- پاک کردن کش: `./deploy/edge-proxy/down.sh -v` (حذف volume `audio_cache`)

## توقف

```bash
./deploy/edge-proxy/down.sh
```
