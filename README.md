# استریم موزیک (Stream Music)

پلتفرم **میزبانی‌شده روی سرور خودتان** برای گوش دادن هم‌زمان به موسیقی در اتاق‌های گروهی: پخش همگام با WebSocket، چت زنده، صف پخش، پلی‌لیست، کاوش محتوا، ناظرگری و پنل مدیریت.

---

## معماری

```text
مرورگر / PWA / اپ بومی (Capacitor)
        ↓
   Nginx (TLS، مسیر /audio)
        ↓
   Next.js (apps/web)  ──REST/WS──►  Django + Daphne (apps/api)
                                        ├── PostgreSQL 16
                                        ├── Redis 7 (Channels + کش)
                                        └── Celery
```

| لایه | مسیر در مخزن | راهنما |
|------|--------------|--------|
| **کل پروژه** | `/` | همین فایل |
| **فرانت‌اند** | `apps/web/` | [apps/web/README.md](apps/web/README.md) |
| **بک‌اند** | `apps/api/` | [apps/api/README.md](apps/api/README.md) |
| **مستندات فنی** | `docs/` | [docs/README.md](docs/README.md) |

---

## فیچرهای محصول (نگاه کلی)

### اتاق و کانال (`channels` + `playback`)

| قابلیت | فرانت‌اند | بک‌اند |
|--------|----------|--------|
| ساخت، ویرایش، بستن و بازگشایی اتاق | `features/channels`، `dashboard` | `channels/`، `close`، `reopen` |
| عمومی / خصوصی / فهرست‌نشده، پیوستن با slug | `/join`، `/join/public/[slug]` | `join`، `join-from-link`، `invite` |
| عضویت، تأیید درخواست پیوستن، خروج | جریان‌های join | `join`، `join-requests`، `leave` |
| پخش همگام (پخش / توقف / جابه‌جایی / بعدی) | `features/player` | `control`، `state`، WebSocket |
| صف، رأی، پرش، shuffle | رابط صف اتاق | `queue/`، `playlists/shuffle` |
| پیشنهاد پلی‌لیست برای اتاق | پنل پیشنهادها | `suggestions` |
| چت (پاسخ، ویرایش، سنجاق، واکنش) | `channel-chat-panel` | `chat/`، `chat/pin` |
| واکنش روی ترک / ایموجی شناور | `room-reaction-*` | `track-reactions` |
| ناظرگری (گزارش، مسدودسازی) | بخش ادمین اتاق | اپ `moderation` |
| گزارش ممیزی + خروجی | ادمین اتاق | `audit-log/` |
| خلاصه مهمانی / نقشه حرارتی | `features/party` | `party-recap` |
| حالت‌های تجربه (تمرین، دروازه مقدمه، …) | `features/experience` | فیلد JSON `experience` کانال |

### کتابخانه و پلی‌لیست (`tracks` + `playlists`)

| قابلیت | فرانت‌اند | بک‌اند |
|--------|----------|--------|
| آپلود ترک (چندبخشی و تکه‌تکه) | بخش ترک‌ها در داشبورد | `tracks/`، `upload/` |
| سطح نمایش و مجوز اشتراک | اشتراک‌گذاری ترک | `share-permissions` |
| علاقه‌مندی ترک / پلی‌لیست | علاقه‌مندی‌های پروفایل | `favorite/` |
| ایجاد / ویرایش / حذف پلی‌لیست و آیتم‌ها | `features/playlists`، داشبورد | `playlists/`، `playlist-items/` |
| افزودن ترک، کپی / اختصاص به کانال | دیالوگ‌ها | `add-tracks`، `copy-to-channel` |
| لینک اشتراک پلی‌لیست | `/share/playlist/[token]` | `share/` |
| وارد کردن اشتراک به صف کانال | دیالوگ import | `queue/import-share` |

### کاوش و اجتماعی (`discovery` + `social`)

| قابلیت | فرانت‌اند | بک‌اند |
|--------|----------|--------|
| کاوش (زنده، محبوب، پلی‌لیست‌ها) | `features/discovery`، `/explore` | `explore/` |
| جستجوی سراسری | دیالوگ جستجوی سراسری | `search/global` |
| دنبال کردن کاربر / کانال | کاوش + پروفایل | `users/.../follow`، `channels/.../follow` |
| پروفایل عمومی | `/users/[username]` | `accounts`، `social` |

### داشبورد و حساب (`dashboard` + `auth` + `accounts`)

| قابلیت | فرانت‌اند | بک‌اند |
|--------|----------|--------|
| ورود، ثبت‌نام، پروفایل | `features/auth`، `/login` | `core/auth/` |
| مدیریت کانال‌ها، QR پیوستن | `dashboard` | `channels/` |
| کتابخانه ترک، ساز پلی‌لیست | بخش‌های داشبورد | `tracks`، `playlists` |
| اعلان‌ها و Web Push | کارت‌های اعلان | `notification-settings`، push |
| محدودیت‌های پریمیوم | کارت پریمیوم | `accounts` |
| کانال‌های آنلاین / پیشنهادهای در انتظار | ویجت‌ها | `dashboard/me/` |

### پشتیبانی و مدیریت (`support` + `admin_panel`)

| قابلیت | فرانت‌اند | بک‌اند |
|--------|----------|--------|
| تیکت پشتیبانی + WebSocket | `support-hub` | `support/` |
| پنل ادمین (کاربران، نشان‌ها، کانال‌ها) | `admin-panel-hub` | `admin/` |

---

## مسیرهای اصلی رابط کاربری

| مسیر | توضیح |
|------|--------|
| `/` | صفحه ورود / هدایت |
| `/login`، `/register` | احراز هویت |
| `/dashboard` | فضای کار (کانال‌ها، کتابخانه، پروفایل، ادمین) |
| `/explore` | کاوش |
| `/channel/[id]` | اتاق (تب شنونده و ادمین) |
| `/join`، `/join/public/[slug]`، `/join/private/[token]` | پیوستن به اتاق |
| `/join/pending` | در انتظار تأیید پیوستن |
| `/users/[username]` | پروفایل عمومی |
| `/share/playlist/[token]` | پلی‌لیست اشتراکی |
| `/party/[channelId]` | خلاصه جلسه |

---

## شروع سریع

```bash
git clone <آدرس-مخزن> && cd stream-music
make ensure-env
docker compose up --build
```

- اپلیکیشن: **http://localhost:8080**
- HTTPS محلی: **https://localhost:8443**

بدون Docker: راهنمای [بک‌اند](apps/api/README.md) و [فرانت‌اند](apps/web/README.md).

---

## دستورات Makefile

```bash
make help                 # فهرست دستورات
make check-quality        # lint، قالب‌بندی، بررسی TypeScript
make test-api             # تست‌های Django
make test                 # Vitest + Django
make openapi-export       # خروجی snapshot از API
make new-feature NAME=discovery   # اسکلت فیچر فرانت
make new-domain NAME=discovery    # اسکلت دامنه بک
```

---

## API و WebSocket

- **REST:** پیشوند `/api/` — به‌روزرسانی snapshot: `make openapi-export`
- **WebSocket پخش:** `ws/channels/{id}` — جزئیات در [docs/realtime-contracts.md](docs/realtime-contracts.md)
- **WebSocket چت:** همان کانال (consumer جدا در بک‌اند)

---

## مستندات تکمیلی

| سند | موضوع |
|-----|--------|
| [docs/architecture.md](docs/architecture.md) | قرارداد پوشه‌ها و import |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | lint، commit، PR |
| [docs/production-deployment.md](docs/production-deployment.md) | استقرار پروداکشن |
| [docs/realtime-contracts.md](docs/realtime-contracts.md) | قرارداد WebSocket |

---

## مجوز

خصوصی — تمامی حقوق محفوظ است.
