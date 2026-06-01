# معماری و ساختار کد

سند مرجع برای چیدمان monorepo، مرز دامنه‌ها و قراردادهای import. جزئیات lint و Git در [CONVENTIONS.md](./CONVENTIONS.md).

---

## Monorepo

```text
stream-music/
├── apps/api/          # Django + Daphne + Channels
├── apps/web/          # Next.js 15
├── platform/          # deploy, infra, scripts (symlink: deploy/, scripts/)
├── docs/              # همین پوشه
├── tooling/           # new-feature, new-domain, openapi export
└── .github/workflows/ # CI, CD, backup
```

Runtime: مرورگر → nginx → Next.js → Django (`/api`, `/ws`) → PostgreSQL + Redis + Celery.

---

## اصول

1. **Route/Page نازک** — `app/**/page.tsx` فقط wiring.
2. **Feature/View نازک** — منطق در `services/` (بک) و `hooks/` / `model/` (فرانت).
3. **بدون `fetch` پراکنده** — فقط `apps/web/src/lib/api/`.
4. **بدون import عمیق بین feature** — `@/features/<name>` یا `shared/` / `lib/`.
5. **بدون پکیج `api/` در Django** — URL-mirror + `*_api.py`.
6. **`apps.common`** — فقط migration history؛ کد جدید ننویسید.

---

## Backend (`apps/api`)

### تجمیع URL

```text
config/urls.py  →  config/api_urls.py  →  apps.<domain>.urls
```

`apps/common/urls.py` فقط re-export از `config.api_urls` (سازگاری قدیمی).

### الگوی هر دامنه

```text
apps/<domain>/
├── models.py | models/
├── selectors.py          # read-only queries
├── services/             # business logic, transactions
├── urls/__init__.py
├── <url_segment>/        # آینه مسیر HTTP
│   ├── *_api.py          # ListCreate / RetrieveUpdateDestroy / APIView
│   └── *_serializers.py
├── consumers.py          # اگر WS دارد
└── tests/
```

| لایه | نقش |
|------|-----|
| `*_api.py` | permission، validate، call service، response |
| `services/` | قوانین کسب‌وکار |
| `selectors/` | queryset بهینه |
| `serializers` | شکل JSON فقط |

قوانین URL: `auth/me/password/` → پوشه `auth/me/password/`؛ `channel_id` ثابت در نام پوشه؛ `-` در URL → `_` در نام فایل.

### نگاشت دامنه

| محصول | App | مسیرهای مهم |
|--------|-----|-------------|
| Auth, health, OpenAPI | `core` | `core/auth/`, `core/health/`, `core/schema/` |
| کانال، چت، صف | `channels` | `channels/channel/`, `channel_id/…` |
| پخش WS | `playback` | consumers + `services/` |
| ترک، آپلود | `tracks` | `tracks/tracks/`, `tracks/upload/` |
| پلی‌لیست | `playlists` | `playlists/playlists/`, `playlist_items/` |
| اکتشاف | `discovery` | `explore/`, `search/` |
| فالو | `social` | `users/follow/`, `channels/follow/` |
| حساب، badge | `accounts` | `accounts/models/`, `auth/me/` |
| پشتیبانی | `support` | `support/support/` |
| ادمین | `admin_panel` | `admin/` |
| داشبورد | `dashboard` | `me/channels-online/` |

### REST و قرارداد API

- پیشوند: `/api/`
- مرور endpointها: `make openapi-export` → `apps/web/src/lib/api/openapi.snapshot.json`
- Schema زنده: `GET /api/schema` — جزئیات snapshot در ADR ادغام‌شده زیر

### وابستگی لایه‌ها

```text
*_api.py  →  services, selectors, serializers
services  →  selectors, models
selectors →  models
```

---

## Frontend (`apps/web`)

```text
src/
├── app/              # routes — نازک
├── features/<name>/  # محصول
│   ├── index.ts      # public API
│   ├── components/
│   ├── hooks/
│   └── model/
├── shared/           # ui, layout, hooks, providers, room, pwa
└── lib/api/          # HTTP + types
```

| قانون | |
|-------|--|
| Cross-feature | فقط `@/features/foo` (barrel) |
| داخل همان feature | مسیر عمیق یا relative مجاز |
| `app/*` | `@/features/*`, `@/shared/*` — نه deep path |

مرجع feature: `features/discovery/`. Scaffold: `make new-feature NAME=slug`.

### نگاشت فرانت ↔ بک

| Feature | API module |
|---------|------------|
| `auth` | `lib/api/auth.ts` |
| `channels`, `dashboard` | `channels.ts` |
| `player` | WS + channels |
| `discovery` | `discovery.ts` |
| `playlists` | `playlists.ts` |

---

## WebSocket

قرارداد payloadها: **[realtime-contracts.md](./realtime-contracts.md)** (تغییر breaking فقط با به‌روزرسانی همان سند).

---

## تست

| لایه | دستور |
|------|--------|
| API | `make test-api` |
| Vitest | `cd apps/web && npm test` |
| E2E | `apps/web/e2e/README.md` — ترجیحاً `docker-compose.e2e.yml` |

---

## تصمیم‌های معماری (خلاصه)

**تفکیک `common`** — اپ‌های `discovery`, `social`, `accounts`, `support`, …؛ URL-mirror؛ حذف `apps/*/api/`. تاریخچه migration در `apps/common/migrations/` می‌ماند؛ حذف از `INSTALLED_APPS` نیاز به squash دارد.

**OpenAPI** — snapshot + `schema-paths.ts` در CI (`make openapi-export`, `make check-openapi`)؛ تایپ‌های request/response دستی در `lib/api/types/` تا پوشش کامل codegen.

---

## چک‌لیست PR (خلاصه)

- منطق در service/hook، نه view/page ضخیم
- endpoint جدید در پوشه آینه URL + `*_api.py`
- HTTP فقط از `lib/api`؛ i18n `en` + `fa`
- تست برای رفتار جدید؛ به‌روز `realtime-contracts.md` اگر WS عوض شد

جزئیات: [CONVENTIONS.md](./CONVENTIONS.md).

---

## راهنماهای کوتاه

### Import ترک از دیسک

```bash
cd apps/api
python manage.py import_audio "/absolute/path/to/music" --owner USERNAME
# --dry-run, --private
```

داخل Docker: `docker compose exec backend python manage.py import_audio …`

### اپ Capacitor (Android/iOS)

```bash
cd apps/web
export CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000   # یا HTTPS production
npm run dev
npx cap sync && npm run cap:android   # یا cap:ios
```

فایل‌ها: `capacitor.config.ts`, `src/lib/capacitor-runtime.ts`, `src/lib/capacitor-background-audio.ts`.

برای پخش در پس‌زمینه iOS/Android بعد از `cap add`، `UIBackgroundModes` = `audio` را در Info.plist بگذارید — راهنما: `apps/web/resources/native/BACKGROUND_AUDIO.md`.
