# فرانت‌اند — `apps/web`

**Next.js 15** (App Router) + **React 18** + **TypeScript** + **Tailwind** + **Radix UI**.

- نگاه کلی پروژه: [README.md](../../README.md)
- ساختار و قرارداد کد: [docs/architecture.md](../../docs/architecture.md)

---

## اجرای محلی

```bash
cd apps/web
cp .env.example .env.local   # اختیاری
npm ci
npm run dev                  # http://localhost:3000
```

وقتی API جدا اجرا می‌شود (rewrite به بک‌اند):

```bash
# در .env.local
DEV_REMOTE_ORIGIN=http://127.0.0.1:8001
```

با **Docker** (از ریشه): فرانت از nginx روی پورت **8080** سرو می‌شود.

### کیفیت و تست

```bash
npm run lint
npm test                   # Vitest
npm run test:e2e           # Playwright — راهنما: apps/web/e2e/README.md
```

---

## فیچرها (`src/features/`)

هر فیچر معمولاً شامل این پوشه‌هاست: `components/`، `hooks/`، `model/`، و `index.ts` (API عمومی ماژول).

| فیچر | مسئولیت | صفحات / ورود |
|------|---------|----------------|
| **auth** | ورود، ثبت‌نام، محافظ مسیر، نشست | `/login`، `/register` |
| **dashboard** | فضای کار: کانال‌ها، کتابخانه، پلی‌لیست، پروفایل، ادمین، پشتیبانی | `/dashboard` |
| **channels** | رابط اتاق: تب ادمین / شنونده، چت، صف، پیوستن | `/channel/[id]`، `/join/*` |
| **player** | پخش همگام، اصلاح drift، پخش‌کننده سراسری | داخل اتاق + `GlobalChannelPlayer` |
| **discovery** | کاوش، جستجو، دنبال‌کردن | `/explore` |
| **playlists** | ساخت و ویرایش، اشتراک، import به کانال | داشبورد + `/share/playlist/[token]` |
| **party** | نقشه حرارتی و خلاصه جلسه | `/party/[channelId]` |
| **experience** | حالت اتاق (تمرین، دروازه مقدمه، قوانین، …) | کروم داخل اتاق |

---

### فیچر `dashboard` — زیربخش‌ها

| بخش | فایل‌های شاخص |
|-----|----------------|
| مدیریت کانال‌ها | `channel-management-section`، `channels/*` |
| کانال‌های دنبال‌شده | `following-channels-section` |
| کتابخانه ترک | `track-library-section` |
| اشتراک‌گذاری ترک | `track-sharing-section` |
| پلی‌لیست | `playlist-manager`، `playlist-builder-section` |
| پروفایل کاربر | `user-profile-hub`، `profile-favorites-panel` |
| ترجیحات اعلان | `notification-preferences-card` |
| محدودیت پریمیوم | `premium-limits-card` |
| پنل ادمین | `admin-panel-hub` |
| پشتیبانی | `support-hub` |
| پیوستن به کانال | `join-channel-dialog`، اسکن QR |

---

### فیچر `channels` — زیربخش‌ها

| بخش | توضیح |
|-----|--------|
| پوسته ادمین | نوار کناری، صف، پیشنهادها، پلی‌لیست، تنظیمات، سلامت |
| پوسته شنونده | صف، پیشنهاد ترک، واکنش‌ها |
| چت | پیام، پاسخ، سنجاق |
| پیوستن | صفحه ورود، slug عمومی، توکن خصوصی |
| ناظرگری | گزارش‌ها (متصل به API `moderation`) |
| زمینه صف | state مشترک صف بین پنل‌ها |

---

### فیچر `player`

| بخش | توضیح |
|-----|--------|
| `use-channel-playback-engine` | WebSocket + المان صوتی |
| `sync-client` | اصلاح اختلاف زمانی (drift) |
| `playback-audience` | حالت تمرین / دروازه مقدمه |
| `GlobalChannelPlayerProvider` | پخش سراسری هنگام جابه‌جایی بین صفحات |

---

## مسیرها (`src/app/`)

فایل‌های `page.tsx` فقط **سیم‌کشی** هستند — منطق در `features/` قرار دارد.

| مسیر | فیچر واردشده |
|------|--------------|
| `page.tsx` | هدایت |
| `login/`، `register/` | `auth` |
| `dashboard/` | `dashboard` |
| `explore/` | `discovery` |
| `channel/[id]/` | `channels` |
| `join/**` | `channels` |
| `join/pending/` | `channels` |
| `users/[username]/` | `discovery` + API پروفایل |
| `share/playlist/[token]/` | `playlists` |
| `party/[channelId]/` | `party` |

---

## لایه API (`src/lib/api/`)

همهٔ درخواست‌های HTTP از این ماژول‌ها — **بدون `fetch` پراکنده در فیچرها**.

| ماژول | دامنه |
|--------|--------|
| `client.ts` | پایه API، CSRF، هدرها |
| `auth.ts` | ورود، پروفایل، push |
| `channels.ts` | اتاق، صف، چت، کنترل پخش |
| `tracks.ts` | ترک، آپلود، اشتراک |
| `playlists.ts` | پلی‌لیست، آیتم‌ها، share |
| `discovery.ts` | کاوش، جستجو، follow |
| `admin.ts` | پنل مدیریت |
| `support.ts` | تیکت پشتیبانی |
| `types/` | تایپ‌ها و `openapi.ts` |

---

## کد مشترک (`shared/`)

کدی که به یک دامنه محصول وابسته نیست:

| پوشه | محتوا |
|------|--------|
| `ui/` | اجزای پایه (shadcn) |
| `layout/` | پوسته، ناوبری، workspace |
| `hooks/` | اتصال مجدد WebSocket، حضور |
| `providers/` | زبان، تم |
| `room/` | منوی فرمان، کروم اتاق |
| `pwa/` | بنر نصب |
| `notifications/` | مرکز اعلان |

وارد کردن: `@/shared/...` — نه از مسیر عمیق فیچر دیگر.

---

## قوانین import

1. **بین فیچرها:** فقط از `@/features/<نام>` (از `index.ts`)
2. **داخل همان فیچر:** مسیر نسبی یا deep مجاز است
3. **`app/` و `shared/`:** بدون `@/features/foo/components/...`

تنظیمات ESLint: `.eslintrc.json`

---

## OpenAPI types

```bash
make openapi-export          # snapshot + path map
make openapi-typescript      # full TS schema (openapi-typescript)
```

Client helper: `src/lib/api/openapi-client.ts`.

## PWA و اپ بومی (Capacitor)

- **PWA:** `public/manifest`، service worker
- **Capacitor:** `capacitor.config.ts` — جزئیات در [docs/architecture.md](../../docs/architecture.md)
- **Native shells:** `make capacitor-native` (adds `ios/` + `android/` and patches `UIBackgroundModes` audio)

---

## افزودن فیچر جدید

```bash
# از ریشه مخزن
make new-feature NAME=my-domain
```

سپس:

1. مسیر نازک در `src/app/.../page.tsx`
2. ماژول API در `src/lib/api/` در صورت نیاز
