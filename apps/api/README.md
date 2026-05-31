# بک‌اند — `apps/api`

**Django 4.2** + **DRF** + **Channels (Daphne)** برای REST و WebSocket. همهٔ URLهای API در `config/api_urls.py` تجمیع شده‌اند.

- نگاه کلی پروژه: [README.md](../../README.md)
- ساختار و قرارداد کد: [docs/architecture.md](../../docs/architecture.md)

---

## اجرای محلی

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env   # یا از ریشه: make ensure-env
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

**Docker** (از ریشه مخزن): `docker compose up` — migrate به‌صورت خودکار اجرا می‌شود.

### تست

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5431 \
POSTGRES_USER=stream_music POSTGRES_PASSWORD=stream_music POSTGRES_DB=stream_music \
.venv/bin/python manage.py test apps
```

یا از ریشه: `make test-api`

---

## اپ‌های Django و فیچرها

### `core` — زیرساخت و احراز هویت

| فیچر | مسیر API |
|------|----------|
| سلامت، متریک، زمان سرور | `GET /api/health`، `/metrics`، `/time` |
| اسکیمای OpenAPI | `GET /api/schema`، `/schema/openapi.json` |
| ثبت‌نام، ورود، خروج | `/api/auth/register`، `login`، `logout` |
| پروفایل کاربر جاری | `GET/PATCH /api/auth/me` |
| تغییر رمز عبور | `/api/auth/me/password` |
| تنظیمات اعلان و Web Push | `/api/auth/me/notification-settings`، `push-subscription` |
| لیست کاربران (جستجو) | `/api/auth/users` |

**کد:** `apps/core/auth/`، `health/`، `schema/`، `services/webpush.py`، `tasks.py`

---

### `channels` — اتاق و نمایش اتاق

| فیچر | نمونه API |
|------|-----------|
| ایجاد / لیست / جزئیات / ویرایش / حذف کانال | `GET/POST /api/channels/`، `GET/PATCH/DELETE .../{id}/` |
| وضعیت و کنترل پخش | `.../state`، `.../control` |
| پیوستن و خروج | `.../join`، `.../leave` |
| پیوستن از لینک | `POST /api/channels/join-from-link` |
| درخواست پیوستن (تأیید / رد) | `.../join-requests`، `.../approve`، `.../reject` |
| بستن و بازگشایی اتاق | `.../close`، `.../reopen` |
| دعوت خصوصی و چرخش لینک | `.../invite`، `.../invite/rotate`، `.../public-link/rotate` |
| اعضا | `.../members`، `.../members/{id}` |
| تنظیمات اتاق و اعلان | `.../settings`، `.../notification-settings` |
| صف پخش (رأی، پرش) | `.../queue`، `.../queue/{item_id}` |
| پخش ترک، پلی‌لیست، shuffle | `.../tracks/{id}/play`، `.../playlists/.../play`، `.../shuffle` |
| ترک‌های مشابه | `.../tracks/similar` |
| چت و سنجاق پیام | `.../chat`، `.../chat/pin` |
| واکنش روی ترک | `.../track-reactions` |
| پیشنهاد پلی‌لیست | `.../suggestions` |
| تاریخچه پخش | `.../history` |
| گزارش ممیزی و خروجی | `.../audit-log`، `.../audit-log/export` |
| خلاصه مهمانی | `.../party-recap` |
| وارد کردن پلی‌لیست اشتراکی به صف | `.../queue/import-share` |
| خروجی جلسه به پلی‌لیست | `.../session/export-playlist` |

**سرویس‌ها:** `channel_join.py`، `channel_queue.py`، `channel_queue_broadcast.py`، `playback_control.py`، `party_recap.py`، `chat_service.py`

**WebSocket:** `playback/consumers.py` — مسیر `ws/channels/{id}`

---

### `playback` — موتور همگام‌سازی پخش

| فیچر | توضیح |
|------|--------|
| `PlaybackSession` | وضعیت پخش اتاق در DB + Redis |
| `PlaybackEvent` | تاریخچه رویدادهای پخش |
| پیش‌رفت صف | منطق ترک بعدی / قبلی در سرویس‌ها |

**کد:** `apps/playback/models.py`، `services/queue_advance.py`، `state_store.py`

---

### `tracks` — کتابخانه ترک

| فیچر | API |
|------|-----|
| لیست، آپلود، ویرایش، حذف | `/api/tracks/` |
| علاقه‌مندی | `/api/tracks/{id}/favorite/` |
| مجوز اشتراک | `/api/tracks/{id}/share-permissions/` |
| آپلود تکه‌تکه | `/api/tracks/upload/init`، `.../chunk`، `.../finalize` |
| فیلتر ژانر / برچسب (کاوش) | `/api/tracks/facets` |

---

### `playlists` — پلی‌لیست

| فیچر | API |
|------|-----|
| ایجاد / لیست / ویرایش / حذف | `/api/playlists/` |
| علاقه‌مندی | `/api/playlists/{id}/favorite/` |
| افزودن ترک‌ها | `/api/playlists/{id}/add-tracks/` |
| کپی یا اختصاص به کانال | `.../copy-to-channel/`، `.../assign-to-channel/` |
| آیتم‌های پلی‌لیست | `/api/playlist-items/` |
| توکن اشتراک | `/api/playlists/share/...` |
| پشتیبان JSON (همه پلی‌لیست‌های کاربر) | `GET /api/playlists/backup-export` |

---

### `discovery` — کاوش

| فیچر | API |
|------|-----|
| فید کاوش | `GET /api/explore` |
| جستجوی سراسری | `GET /api/search/global` |
| فیلترهای ترک | `GET /api/tracks/facets` |

---

### `social` — اجتماعی

| فیچر | API |
|------|-----|
| دنبال کردن کانال | `POST/DELETE /api/channels/{id}/follow` |
| دنبال کردن کاربر | `/api/users/{username}/follow` |
| کانال‌های دنبال‌شده | `GET /api/me/following-channels` |

---

### `accounts` — حساب و پروفایل

| فیچر | API |
|------|-----|
| پروفایل عمومی | `/api/auth/me/public-profile`، `/api/users/.../profile` |
| محدودیت‌های پریمیوم | `/api/auth/me/premium-limits` |
| نشان‌ها (مدل) | `accounts/models/` — مدیریت در `admin_panel` |
| علاقه‌مندی‌ها | `UserTrackFavorite`، `UserPlaylistFavorite` |

---

### `dashboard` — ویجت‌های داشبورد

| فیچر | API |
|------|-----|
| کانال‌های آنلاین | `GET /api/me/channels-online` |
| پیشنهادهای در انتظار | `GET /api/me/channels-pending-suggestions` |

---

### `moderation` — ناظرگری

| فیچر | API |
|------|-----|
| گزارش چت، مسدودسازی موقت | `/api/channels/{id}/moderation/...` |

---

### `support` — پشتیبانی

| فیچر | API |
|------|-----|
| دسته‌بندی تیکت | `/api/support/categories` |
| تیکت و پیام‌ها | `/api/support/tickets/...` |
| WebSocket تیکت | consumer در `support/` |

---

### `admin_panel` — پنل مدیریت

| فیچر | API |
|------|-----|
| نمای کلی | `/api/admin/overview` |
| کاربران، نشان‌ها، کانال‌ها | `/api/admin/users`، `badges`، `channels` |
| سلامت سیستم | `/api/admin/health` |

---

### `common` — فقط migration

`apps/common/migrations/` — **کد runtime جدید اضافه نکنید.** `urls.py` فقط از `config.api_urls` re-export می‌کند.

---

## الگوی ساختار کد

```text
apps/<دامنه>/
├── selectors.py      # خواندن از DB
├── services/         # منطق کسب‌وکار
├── urls/__init__.py
└── <آینه-url>/*_api.py
```

- قوانین: [docs/architecture.md](../../docs/architecture.md)
- Lint: `ruff check .`

---

## OpenAPI

از **ریشه مخزن:**

```bash
make openapi-export
```

خروجی: `apps/web/src/lib/api/openapi.snapshot.json`
