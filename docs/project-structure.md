# ساختار پروژه Stream Music

**نسخه:** 2.0  
**وضعیت:** سند مرجع — معماری **فعلی** (مهاجرت ساختاری تکمیل شده)  
**آخرین به‌روزرسانی:** 2026-05-28  

> فهرست همه اسناد: [docs/README.md](./README.md)

این سند «منبع حقیقت» برای چیدمان کد، مرز دامنه‌ها، قراردادهای نام‌گذاری و مسیر مهاجرت از ساختار فعلی به ساختار هدف است. هدف همانند الگوهای **Cookiecutter** است: هر فیچر جدید از یک قالب ثابت ساخته شود و کل تیم (و ابزارهای AI) بدون حدس زدن بدانند فایل کجا قرار می‌گیرد.

---

## فهرست مطالب

1. [اهداف و اصول](#اهداف-و-اصول)
2. [نمای کلی Monorepo](#نمای-کلی-monorepo)
3. [وضعیت فعلی در برابر هدف](#وضعیت-فعلی-در-برابر-هدف)
4. [لایه Platform](#لایه-platform)
5. [لایه Backend (Django)](#لایه-apps/api)
6. [لایه Frontend (Next.js)](#لایه-apps/webjs)
7. [نگاشت دامنه‌ها (فرانت ↔ بک)](#نگاشت-دامنه‌ها-فرانت--بک)
8. [قراردادهای نام‌گذاری](#قراردادهای-نام‌گذاری)
9. [قوانین وابستگی (Import Rules)](#قوانین-وابستگی-import-rules)
10. [API Client و قراردادهای شبکه](#api-client-و-قراردادهای-شبکه)
11. [بین‌المللی‌سازی (i18n)](#بین‌المللی‌سازی-i18n)
12. [تست‌ها](#تست‌ها)
13. [قالب‌های توسعه (Scaffolding)](#قالب‌های-توسعه-scaffolding)
14. [مستندات و ADR](#مستندات-و-adr)
15. [نقشه مهاجرت](#نقشه-مهاجرت)
16. [چک‌لیست Pull Request](#چک‌لیست-pull-request)
17. [پیوست: نگاشت فایل‌های فعلی](#پیوست-نگاشت-فایل‌های-فعلی)

---

## اهداف و اصول

### اهداف

| هدف | توضیح |
|-----|--------|
| **یکدستی** | هر دامنه محصول در بک‌اند و فرانت‌اند شکل پوشه و لایه‌های یکسان دارد. |
| **مرزبندی** | منطق کسب‌وکار از UI و از transport (HTTP/WS) جدا است. |
| **قابلیت تست** | سرویس‌ها و hookها بدون render کامل UI قابل تست‌اند. |
| **مقیاس تیمی** | چند نفر روی دامنه‌های مختلف بدون conflict ساختاری کار کنند. |
| **Onboarding سریع** | توسعه‌دهنده جدید با خواندن این سند + یک نمونه feature راه بیفتد. |

### اصول غیرقابل مذاکره

1. **Route نازک، Feature ضخیم** — فایل‌های `app/**/page.tsx` فقط wiring (AuthGuard، layout، import یک کامپوننت اصلی).
2. **View نازک، Service ضخیم** — Viewهای Django فقط validate → call service → serialize response.
3. **بدون God Module** — ماژول `common` به‌تدریج به دامنه‌های مشخص تقسیم می‌شود؛ `core` فقط زیرساخت فنی است.
4. **بدون fetch پراکنده** — تمام درخواست‌های HTTP از `lib/api` (یا زیرماژول‌های آن) عبور می‌کنند.
5. **Feature به Feature وابسته نشود** — اشتراک از طریق `shared/` یا `entities/`.
6. **هر تصمیم معماری مهم → ADR** — در `docs/adr/`.

---

## نمای کلی Monorepo

ساختار **هدف** ریشه repository:

```text
stream-music/
├── README.md
├── Makefile                      # دستورات یکپارچه dev / test / lint
├── docker-compose.yml
├── .env.example
│
├── docs/                         # مستندات (این سند + runbook + ADR)
│   ├── project-structure.md      # ← همین فایل
│   ├── ARCHITECTURE.md           # دیاگرام runtime (اختیاری؛ می‌تواند از README استخراج شود)
│   ├── CONVENTIONS.md            # جزئیات lint، commit، branch
│   ├── adr/
│   └── runbooks/
│
├── tooling/                      # قالب‌ها و اسکریپت‌های codegen
│   ├── templates/
│   │   ├── django-domain/
│   │   └── next-feature/
│   └── scripts/
│
├── apps/                         # ── محصول ──
│   ├── api/                      # Django (فعلی: apps/api)
│   └── web/                      # Next.js (فعلی: apps/web)
│
└── platform/                     # ── زیرساخت ──
    ├── deploy/
    ├── infra/
    └── scripts/                  # backup، vapid، ...
```

> **توجه:** در فاز اول مهاجرت، نام‌های فعلی `apps/api` و `apps/web` حفظ می‌شوند. rename به `apps/api` و `apps/web` اختیاری و در فاز ۳ انجام می‌شود.

### دیاگرام لایه‌های runtime

```text
┌─────────────────────────────────────────────────────────────────┐
│  Client (Browser / PWA / Capacitor WebView)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│  Nginx — TLS، static audio، proxy /api و /ws                     │
└─────────────┬───────────────────────────────┬───────────────────┘
              │                               │
┌─────────────▼─────────────┐   ┌─────────────▼───────────────────┐
│  Next.js (apps/web)        │   │  Django + Daphne (apps/api)    │
│  app/ → features/ → api   │   │  *_api.py → services/ → models │
└─────────────┬─────────────┘   └─────────────┬───────────────────┘
              │                               │
              │         REST + WebSocket      │
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │  PostgreSQL  │  Redis  │ Celery │
              └───────────────────────────────┘
```

---

## وضعیت معماری (خلاصه)

| لایه | وضعیت |
|------|--------|
| Backend HTTP | URL-mirror + `*_api.py`؛ تجمیع URL در `config/api_urls.py` |
| `apps.common` | فقط migration + shim (`urls` re-export) — [ADR-003](./adr/003-common-migration-shim.md) |
| Frontend | `features/<domain>/` + `shared/`؛ import بین feature از barrel `@/features/<name>` |
| کیفیت | `make check-quality`، pre-commit، ۶۲+ تست API، Vitest، OpenAPI snapshot — [ADR-004](./adr/004-api-contract-snapshot.md) |

### نمونه مرجع (Explore)

ماژول `features/discovery/` پس از refactor Explore:

```text
features/discovery/
├── explore-page.tsx              # orchestrator صفحه
├── components/                   # (پیشنهاد: انتقال فایل‌های UI به این پوشه)
├── hooks/
│   ├── use-explore-feed.ts
│   ├── use-discoverable-users.ts
│   └── use-explore-channel-follow.ts
├── model/
│   └── explore-utils.ts
└── index.ts                      # exportهای public ماژول
```

---

## لایه Platform

مسئولیت: deploy، infra، backup، CI — **بدون منطق محصول**.

```text
platform/
├── deploy/           # اسکریپت‌ها، env نمونه، edge-proxy
├── infra/            # nginx templates، ssl
└── scripts/          # generate-vapid-keys، backup

.github/workflows/    # CI (lint, test) + CD (deploy)
```

قانون: تغییرات `platform/` جدا از PRهای feature محصول review می‌شوند.

---

## لایه Backend (Django)

### ساختار هدف `apps/api/`

```text
apps/api/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py                 # include دامنه‌ها
│   ├── asgi.py
│   ├── celery.py
│   └── middleware/
│
├── core/                       # زیرساخت فنی — بدون domain business
│   ├── auth/                   # login, logout, register, me, csrf
│   ├── health/
│   ├── pagination.py
│   ├── permissions.py
│   └── exceptions.py
│
└── apps/                       # هر دامنه = یک Django app (مسیر واقعی: apps/api/apps/)
    ├── channels/
    ├── playback/
    ├── tracks/
    ├── playlists/
    ├── discovery/
    ├── social/
    ├── accounts/
    ├── moderation/
    ├── support/
    └── admin_panel/
```

### الگوی ثابت هر Domain App

**هر** دامنه **باید** این ساختار را داشته باشد (فایل‌های غیرضروری برای دامنه‌های بدون WS حذف می‌شوند):

```text
apps/<domain_name>/
├── __init__.py
├── apps.py
├── models.py                   # یا models/ اگر > ~300 خط
├── selectors.py
├── services/
│   └── <use_case>.py
├── urls/                       # مانند models/ — تجمیع routeها
│   ├── __init__.py             # urlpatterns اصلی دامنه
│   └── <group>_urls.py         # اختیاری اگر urlpatterns بزرگ شد
├── <url_segment>/              # آینه مسیر HTTP (بدون پیشوند /api/)
│   ├── <endpoint>_api.py       # generics.* یا APIView — نازک
│   └── <endpoint>_serializers.py  # در همان پوشه، اگر لازم است
├── serializers/                # اختیاری — serializerهای مشترک چند endpoint
├── consumers.py
├── routing.py
├── tasks.py
├── migrations/
└── tests/
```

#### نگاشت URL → پوشه و فایل

| قانون | مثال |
|--------|------|
| هر segment مسیر = یک پوشه | `auth/me/password` → `auth/me/password/` |
| `-` در URL → `_` در نام پوشه/فایل | `join-from-link` → `join_from_link/` |
| View در `*_api.py` | `password_api.py` → `UserPasswordChangeView` |
| Serializer در `*_serializers.py` کنار همان endpoint | `password_serializers.py` |
| `global` و کلمات رزرو پایتون | مسیر `search/global` → پوشه `search/global_search/` |
| CRUD collection | `ListCreateAPIView` + `RetrieveUpdateDestroyAPIView` در `urls/` (بدون Router/ViewSet) |
| پارامتر مسیر Django | `<channel_id>` → پوشه `channel_id/` (ثابت، نه مقدار runtime) |
| چند view در یک فایل | فقط وقتی فایل کوچک است؛ `channels` اکنون leaf per endpoint زیر `channel_id/` |

**مثال (`core`):**

```text
core/
├── urls/__init__.py
├── health/health_api.py
├── auth/me/password/password_api.py
├── auth/me/password/password_serializers.py
└── services/webpush.py
```

**ممنوع:** پکیج `api/` با `views.py` / `serializers.py` / `urls.py` متمرکز — جایگزین: ساختار بالا.

### مسئولیت لایه‌ها

| لایه | مسئولیت | مثال |
|------|---------|------|
| **models** | schema، constraints، `__str__`، متدهای ساده مدل | `Channel`, `ChannelMembership` |
| **selectors** | خواندن DB، بهینه‌سازی query، بدون side effect | `get_live_public_channels()` |
| **services** | قوانین کسب‌وکار، transaction، emit event | `follow_channel(user, channel)` |
| **\*_api.py** | permission، validate input، فراخوانی service، response | `ExploreFeedView` در `explore/explore_api.py` |
| **\*_serializers.py** | شکل JSON ورودی/خروجی | `password_serializers.py` کنار `password_api.py` |
| **consumers** | پیام WS، delegate به service | `ChannelChatConsumer` |
| **tasks** | کار async / scheduled | `send_webpush_batch` |

### قوانین وابستگی Backend

```text
*_api.py     →  services, selectors, *_serializers, core.permissions
services     →  selectors, models, core (exceptions)
selectors    →  models
models       →  (فقط Django / stdlib)
urls/        →  *_api (import view classes)
tasks        →  services
consumers    →  services
```

**ممنوع:**

- QuerySet پیچیده داخل `*_api.py`
- import دامنه A از models دامنه B بدون interface/service مشخص
- قرار دادن business logic در `serializers` (فقط validation/format)

### URL و نسخه‌بندی API

```text
/api/                           # REST فعلی (بدون prefix نسخه تا تصمیم ADR)
/api/auth/...
/api/channels/...
/api/explore/...
/api/search/global/
```

هر domain پکیج `urls/` دارد؛ تجمیع REST در `apps/common/urls.py`:

```python
# apps/common/urls.py
urlpatterns = [
    path("", include("apps.core.urls")),
    path("", include("apps.channels.urls")),
    # ...
]
```

`include("apps.core.urls")` همان `apps/core/urls/__init__.py` است (نه `api/urls.py`).

### تقسیم پیشنهادی `apps/common` (فعلی)

| ماژول فعلی (تقریبی) | Domain هدف |
|---------------------|------------|
| `views.py` (auth) | `core/auth/` |
| `discovery_views.py`, `social_expansion_views.py` (explore) | `domains/discovery/` |
| `social_models.py`, follow endpoints | `domains/social/` |
| `user_badges`, public profile | `domains/accounts/` |
| `moderation_views.py` | `domains/moderation/` |
| `support_*` | `domains/support/` |
| `admin_views.py` | `domains/admin_panel/` |
| `health.py`, `metrics.py` | `core/health/` |
| `favorites.py`, `party_recap.py` | دامنه مرتبط (playlists/playback) یا `accounts` |

---

## لایه Frontend (Next.js)

### ساختار هدف `apps/web/src/`

```text
src/
├── app/                          # App Router — فقط routes
│   ├── layout.tsx
│   ├── (auth)/login/page.tsx
│   ├── dashboard/page.tsx
│   ├── explore/page.tsx
│   ├── channel/[id]/page.tsx
│   └── ...
│
├── features/                     # ماژول‌های محصول (مرجع اصلی UI logic)
│   ├── auth/
│   ├── channels/
│   ├── dashboard/
│   ├── discovery/
│   ├── player/
│   ├── playlists/
│   ├── party/
│   └── ...
│
├── shared/                       # کد مشترک بدون domain مشخص
│   ├── ui/                       # shadcn / primitives (فعلی: components/ui)
│   ├── layout/                   # shell, workspace, nav
│   ├── providers/                # locale, theme, toast
│   ├── hooks/                    # useHotkeys و ... عمومی
│   └── lib/
│       ├── utils.ts
│       └── constants.ts
│
├── entities/                     # (اختیاری) type + mapper مشترک بین features
│   ├── channel/
│   └── user/
│
└── lib/
    ├── api/                      # transport layer
    │   ├── client.ts
    │   ├── types/
    │   └── modules/
    ├── i18n/
    └── notifications/
```

> مهاجرت تدریجی: `components/ui` → `shared/ui`، `components/layout` → `shared/layout`.

### الگوی ثابت هر Feature

```text
features/<feature_name>/
├── index.ts                      # Public API ماژول — فقط exportهای مجاز
├── <feature>-page.tsx             # کامپوننت سطح صفحه / workspace
├── components/                   # UI اختصاصی این feature
│   └── <component>.tsx
├── hooks/                        # state، data fetching، side effects
│   └── use-<thing>.ts
├── model/                        # types محلی، mapper، pure functions
│   └── <feature>-utils.ts
└── __tests__/                    # unit tests (Vitest)
```

### قوانین Feature

| قانون | جزئیات |
|-------|--------|
| Public API | سایر بخش‌ها فقط از `features/foo/index.ts` import کنند |
| Colocation | تست و hook کنار همان feature |
| بدون default export اجباری | named export برای tree-shaking بهتر |
| Server vs Client | `"use client"` فقط در فایل‌هایی که به hook/event نیاز دارند |

### الگوی صفحه App Router

```tsx
// app/explore/page.tsx — ایده‌آل (نازک)
import { AuthGuard } from "@/features/auth";
import { ExplorePage } from "@/features/discovery";
import { WorkspacePanel } from "@/shared/layout/workspace";

export default function ExploreRoute() {
  return (
    <AuthGuard>
      <WorkspacePanel tab="channels" headerTitleKey="explore.title" ...>
        <ExplorePage />
      </WorkspacePanel>
    </AuthGuard>
  );
}
```

### قوانین وابستگی Frontend

```text
app/*              →  features/*, shared/*
features/A/*       →  shared/*, entities/*, lib/api/*
features/A/*       →  ✗ features/B/*  (مستقیم ممنوع)
shared/*           →  lib/* (محدود)
lib/api/*          →  ✗ features/*
```

اگر دو feature به هم نیاز دارند → منطق مشترک به `entities/` یا `shared/` منتقل شود.

---

## نگاشت دامنه‌ها (فرانت ↔ بک)

| دامنه محصول | Backend (`domains/`) | Frontend (`features/`) | API module (`lib/api/modules/`) |
|-------------|----------------------|-------------------------|----------------------------------|
| احراز هویت | `core/auth` | `auth` | `auth.ts` |
| روم / کانال | `channels` | `channels`, `dashboard/channels` | `channels.ts` |
| پخش / صف | `playback` | `player`, `room` | `playback.ts` (یا داخل channels) |
| کتابخانه آهنگ | `tracks` | — (dashboard) | `tracks.ts` |
| پلی‌لیست | `playlists` | `playlists` | `playlists.ts` |
| کاوش / جستجو | `discovery` | `discovery` | `discovery.ts` |
| اجتماعی (follow) | `social` | بخشی از `discovery` یا `social` | `social.ts` |
| پروفایل عمومی | `accounts` | profile در dashboard | `auth.ts` / `users.ts` |
| moderation | `moderation` | admin/room | `moderation.ts` |
| پشتیبانی | `support` | support UI | `support.ts` |
| ادمین | `admin_panel` | dashboard admin | `admin.ts` |

Endpoint جدید باید در هر سه ستون نام هم‌خوان داشته باشد (مثلاً `ExploreFeed` نه نام‌های متفاوت در هر لایه).

---

## قراردادهای نام‌گذاری

### عمومی

| نوع | قرارداد | مثال |
|-----|---------|------|
| پوشه domain | `kebab-case` | `admin-panel` یا `admin_panel` در Python: `snake_case` |
| فایل React | `kebab-case.tsx` | `explore-room-card.tsx` |
| کامپوننت React | `PascalCase` | `ExploreRoomCard` |
| Hook | `use` + `camelCase` | `useExploreFeed` |
| فایل Python | `snake_case.py` | `explore_feed.py` |
| endpoint HTTP | `<name>_api.py` در پوشه آینه URL | `auth/me/password/password_api.py` |
| serializer endpoint | `<name>_serializers.py` کنار `*_api` | `password_serializers.py` |
| کلاس Django | `PascalCase` | `ExploreFeedView` |
| تست Python | `test_<unit>.py` | `test_explore_feed.py` |
| تست E2E | `<domain>.spec.ts` | `discovery-explore.spec.ts` |

### i18n keys

الگو: `<domain>.<context>.<name>`

```text
explore.liveChannels
explore.filterLiveOnly
follow.notifyOn
channels.reopenSuccess
```

همیشه **هر دو** locale (`en`, `fa`) در `lib/i18n/messages.ts` (تا جداسازی فایل locale در ADR جداگانه).

### Git branches (پیشنهاد)

```text
feature/<ticket>-<short-description>
fix/<ticket>-<short-description>
docs/<topic>
chore/<topic>
```

---

## قوانین وابستگی (Import Rules)

### Backend — مثال مجاز

```python
# apps/discovery/explore/explore_api.py
from apps.discovery.services.explore_feed import build_explore_feed
from apps.discovery.selectors import live_public_channels
```

### Backend — مثال ممنوع

```python
# domains/discovery/services/explore_feed.py
from domains.channels.api.views import ChannelListView  # ✗
```

### Frontend — مثال مجاز

```typescript
// features/discovery/explore-page.tsx
import { getExploreFeed } from "@/lib/api";
import { useExploreFeed } from "./hooks/use-explore-feed";
```

### Frontend — مثال ممنوع

```typescript
// features/discovery/explore-page.tsx
import { ChannelCard } from "@/features/dashboard/channels/channel-card"; // ✗
```

---

## API Client و قراردادهای شبکه

### ساختار هدف `lib/api/`

```text
lib/api/
├── client.ts              # getApiBase, withAuthHeaders, extractApiError
├── types/
│   ├── channel.ts
│   ├── discovery.ts
│   ├── auth.ts
│   └── index.ts           # re-export
└── modules/
    ├── channels.ts        # توابع fetch مرتبط
    ├── discovery.ts
    └── ...
```

### قرارداد توابع

```typescript
// نام‌گذاری: فعل + موجودیت
getExploreFeed(params?: ExploreFeedParams): Promise<ExploreFeed>
followChannel(channelId: string, notifyLive?: boolean): Promise<ChannelFollowState>
```

### خطا

- همه خطاهای API از `extractApiError` یا throw `Error` با پیام قابل نمایش
- UI فقط toast می‌کند؛ **parse JSON خطا در کامپوننت** ممنوع

### WebSocket

- مسیرهای WS در `lib/` یا `features/<x>/realtime/` متمرکز
- قرارداد event در `docs/realtime-contracts.md` (موجود) به‌روز نگه داشته شود

---

## بین‌المللی‌سازی (i18n)

| محل | مسئولیت |
|-----|---------|
| `lib/i18n/messages.ts` | دیکشنری `en` / `fa` |
| `components/providers/locale-provider` | Context و `t()` |
| Feature UI | فقط `t("key")` — بدون رشته hardcode کاربرمحور |

کلید جدید = همان نام دامنه API/UI.

---

## تست‌ها

### Backend (`pytest`)

```text
domains/<name>/tests/
├── test_selectors.py    # DB با fixture
├── test_services.py     # service با mock حداقلی
└── test_api.py          # APIClient / APITestCase
```

نام تست: `test_<behavior>_<expected_outcome>`.

### Frontend (`Vitest`)

```text
features/<name>/__tests__/
lib/**/__tests__/
```

تست pure function در `model/`؛ تست hook با `@testing-library/react`.

### E2E (`Playwright`)

```text
e2e/
├── helpers/
├── discovery/
│   └── explore.spec.ts
├── channels/
└── social/
```

هر فایل spec یک user journey؛ helper مشترک در `e2e/helpers/`.

---

## قالب‌های توسعه (Scaffolding)

پوشه هدف: `tooling/templates/`

### `django-domain`

ایجاد:

- `domains/<name>/` با ساختار کامل
- ثبت در `INSTALLED_APPS`
- `include` در `config/urls.py`
- فایل تست خالی

### `next-feature`

ایجاد:

- `features/<name>/` با `index.ts`, hooks/, components/
- stub `app/.../page.tsx` در صورت نیاز

### دستور Makefile (هدف)

```makefile
make dev
make test
make lint
make new-domain NAME=discovery    # backend scaffold
make new-feature NAME=discovery   # frontend scaffold
```

---

## مستندات و ADR

فهرست کامل: **[docs/README.md](./README.md)**

| سند | محتوا |
|-----|--------|
| `docs/project-structure.md` | این سند |
| `docs/CONVENTIONS.md` | commit، lint، pre-commit |
| `docs/api-endpoints.md` | REST + OpenAPI |
| `docs/realtime-contracts.md` | WebSocket |
| `docs/production-deployment.md` | استقرار پروداکشن |
| `docs/adr/NNN-*.md` | تصمیم‌های معماری |

### قالب ADR کوتاه

```markdown
# ADR-001: Split common into domain apps

## Status
Accepted

## Context
apps/common grew to 15+ responsibility areas...

## Decision
Split into discovery, social, accounts, ...

## Consequences
+ Clear boundaries; - Migration effort
```

---

## تکامل معماری (تکمیل‌شده)

مهاجرت از `apps/common` و پکیج‌های `api/` به اپ‌های دامنه + URL-mirror انجام شده است. تاریخچه: [ADR-001](./adr/001-project-structure-and-domain-split.md)، [ADR-002](./adr/002-discovery-and-social-apps.md).

اختیاری آینده: حذف `apps.common` از `INSTALLED_APPS` ([ADR-003](./adr/003-common-migration-shim.md))؛ گسترش قرارداد API ([ADR-004](./adr/004-api-contract-snapshot.md)).

---

## چک‌لیست Pull Request

قبل از merge:

- [ ] **مرز دامنه** رعایت شده؛ منطق در service/hook نه `*_api.py` / page
- [ ] **Backend HTTP** endpoint جدید در پوشه آینه URL + `*_api.py` (نه `api/views.py`)
- [ ] **Route/Page** فقط wiring است
- [ ] **API** فقط از `lib/api` (بدون `fetch` پراکنده)
- [ ] **i18n** کلید `en` + `fa` اضافه شده
- [ ] **تست** حداقل یک case برای logic جدید (service یا hook یا API)
- [ ] **مستندات** اگر قرارداد WS/API عوض شد → به‌روز `docs/realtime-contracts.md` یا ADR
- [ ] **وابستگی** بین feature فقط از `@/features/<name>` (barrel)، نه deep path
- [ ] **Migration** Django اگر model عوض شد
- [ ] **E2E** اگر user journey اصلی touch شد (یا ticket برای follow-up)

---

## پیوست: ماژول‌های کاننیکال (بک‌اند)

| نگرانی | مسیر |
|--------|------|
| تجمیع URL | `config/api_urls.py` |
| Auth / health / OpenAPI | `apps/core/` |
| کانال / صف / چت | `apps/channels/` + `services/` |
| پخش WS | `apps/playback/` |
| ترک / آپلود | `apps/tracks/` |
| پلی‌لیست | `apps/playlists/` |
| اکتشاف / جستجو | `apps/discovery/` |
| فالو / اجتماعی | `apps/social/` |
| حساب / badge | `apps/accounts/` |
| پشتیبانی | `apps/support/` |
| ادمین | `apps/admin_panel/` |
| `common` | فقط `migrations/` — بدون کد runtime |

---

## مراجع داخلی

- [README.md](../README.md) — Quick start و overview
- [realtime-contracts.md](./realtime-contracts.md) — WebSocket
- [production-deployment.md](./production-deployment.md) — Deploy
- [e2e/README.md](../apps/web/e2e/README.md) — تست E2E

---

*این سند با تکامل محصول به‌روز می‌شود. تغییرات ساختاری مهم نیازمند PR جداگانه و در صورت نیاز ADR در `docs/adr/` هستند.*
