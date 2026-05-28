# ساختار پروژه Stream Music

**نسخه:** 1.0  
**وضعیت:** سند مرجع (Target Architecture)  
**آخرین به‌روزرسانی:** 2026-05-28  

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
│  app/ → features/ → api   │   │  api/ → services/ → models      │
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

## وضعیت فعلی در برابر هدف

### Backend

| وضعیت | مسیر | اقدام هدف |
|--------|------|-----------|
| ✅ خوب | `apps/channels`, `playback`, `tracks`, `playlists` | حفظ + اعمال الگوی لایه‌ای یکسان |
| ✅ انجام شد | `apps/common` | فقط badges + shimها؛ مدل‌های منتقل‌شده در اپ دامنه با `db_table` قدیمی |
| ✅ انجام شد | serializers | `*/api/serializers.py` per domain + `common/serializers.py` re-export |
| ✅ انجام شد | `discovery`, `social`, `accounts`, `core`, … | اپ‌های دامنه + `urls` per domain |
| ✅ انجام شد | `config/settings/` | base + local/production |

### Frontend

| وضعیت | مسیر | اقدام هدف |
|--------|------|-----------|
| ✅ خوب | `src/features/*` | الگوی مرجع؛ هر feature زیرپوشه `components/`, `hooks/`, `model/` |
| ✅ خوب | `src/lib/api/*` | split تدریجی `types.ts` به `types/` |
| ✅ انجام شد | `src/shared/ui`, `shared/layout`, `shared/hooks` | جایگزین `components/ui` و `hooks/` ریشه |
| ✅ انجام شد | `src/shared/` | `ui/`, `layout/`, `hooks/`, `providers/`, `room/`, `pwa/`, `notifications/` |
| ✅ انجام شد | `features/*` | `components/`, `hooks/`, `model/`, `index.ts` (auth, channels, dashboard, player, discovery, …) |

### نمونه موفق (الگوی مرجع)

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
└── domains/                    # هر دامنه = یک Django app
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

> در repository فعلی مسیر `apps/api/apps/` است. تا زمان rename، `domains/<name>` معادل `apps/<name>` خوانده شود.

### الگوی ثابت هر Domain App

**هر** دامنه **باید** این ساختار را داشته باشد (فایل‌های غیرضروری برای دامنه‌های بدون WS حذف می‌شوند):

```text
domains/<domain_name>/
├── __init__.py
├── apps.py
├── models.py                   # یا models/ اگر > ~300 خط
├── selectors.py                # QuerySetهای read-only، فیلتر، prefetch
├── services/
│   ├── __init__.py
│   └── <use_case>.py           # منطق write و orchestration
├── api/
│   ├── __init__.py
│   ├── serializers.py
│   ├── views.py                # یا views/ اگر بزرگ شد
│   └── urls.py
├── consumers.py                # فقط اگر WebSocket دارد
├── routing.py                  # WS routing
├── tasks.py                    # Celery tasks
├── admin.py
├── migrations/
└── tests/
    ├── test_selectors.py
    ├── test_services.py
    └── test_api.py
```

### مسئولیت لایه‌ها

| لایه | مسئولیت | مثال |
|------|---------|------|
| **models** | schema، constraints، `__str__`، متدهای ساده مدل | `Channel`, `ChannelMembership` |
| **selectors** | خواندن DB، بهینه‌سازی query، بدون side effect | `get_live_public_channels()` |
| **services** | قوانین کسب‌وکار، transaction، emit event | `follow_channel(user, channel)` |
| **api/views** | permission، validate input، فراخوانی service، response | `ExploreFeedView` |
| **serializers** | شکل JSON ورودی/خروجی | `ChannelSummarySerializer` |
| **consumers** | پیام WS، delegate به service | `ChannelChatConsumer` |
| **tasks** | کار async / scheduled | `send_webpush_batch` |

### قوانین وابستگی Backend

```text
api          →  services, selectors, serializers, core.permissions
services     →  selectors, models, core (exceptions)
selectors    →  models
models       →  (فقط Django / stdlib)
tasks        →  services
consumers    →  services
```

**ممنوع:**

- QuerySet پیچیده داخل `views.py`
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

هر domain فایل `api/urls.py` خود را دارد؛ `config/urls.py` فقط `include` می‌کند:

```python
# config/urls.py (هدف)
urlpatterns = [
    path("api/", include("domains.discovery.api.urls")),
    path("api/", include("domains.channels.api.urls")),
    # ...
]
```

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
# domains/discovery/api/views.py
from domains.discovery.services.explore_feed import build_explore_feed
from domains.discovery.selectors import live_public_channels
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

| سند | محتوا |
|-----|--------|
| `docs/project-structure.md` | این سند — ساختار و قراردادها |
| `docs/realtime-contracts.md` | قرارداد WS (موجود) |
| `docs/production-deployment.md` | deploy (موجود) |
| `docs/CONVENTIONS.md` | commit، formatting، pre-commit |
| `docs/adr/NNN-title.md` | تصمیم‌های معماری |

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

## نقشه مهاجرت

### فاز ۰ — ثبت قرارداد (انجام / در حال انجام)

- [x] سند `docs/project-structure.md`
- [x] `docs/CONVENTIONS.md`
- [x] لینک از `README.md` به این سند
- [x] `.cursor/rules/project-agent.mdc` (`alwaysApply`) + `AGENTS.md`

### فاز ۱ — Frontend یکدست (۲ هفته)

- [x] استاندارد `features/<x>/{components,hooks,model,index.ts}` — الگوی مرجع: `discovery`
- [x] انتقال Explore به `components/` + `model/` + `index.ts`
- [x] split `lib/api/types.ts` → `lib/api/types/*`
- [x] `Makefile` + `tooling/scripts/new-feature.sh`
- [x] ممنوعیت import مستقیم feature↔feature در ESLint (هشدار در `.eslintrc.json`)

### فاز ۲ — Backend split `common` (۳–۵ هفته)

1. [x] `discovery` ← explore + global search + track facets (`apps/discovery/`, services + api)  
2. [x] `social` ← follow user/channel + following feed (`apps/social/`)  
3. [x] `accounts` ← profile, premium (`apps/accounts/api/`)  
4. [x] `playlists/api` ← playlist share links  
5. [x] `channels/api` ← queue import-share, session export  
6. [x] `support`, `moderation`, `admin_panel`, `dashboard`  
7. [x] `core` ← health, metrics, schema, auth routes (`apps/core/api/`)  
8. [x] `config/settings/` ← base + local/production (`DJANGO_ENV`)  
9. [x] shimهای `apps/common/*_views.py` برای سازگاری  
10. [x] `common/views.py` → `core/auth_views`, `channels/api/*`, `tracks/playlists` viewsets  
11. [x] `common/urls.py` فقط `include()` دامنه‌ها  
12. [x] `common/serializers.py` → `*/api/serializers.py` per domain  
13. [x] `party_recap` → `channels/services/`  
14. [x] `social/models.py`, `support/models.py`, `accounts/models.py` + migration state-only (`0006`)  
15. [x] `channels/services/playback_control.py` — منطق control از view جدا شد  
16. [x] `channels/api/views/` — split از `channel_views.py` (viewset, playback, queue, join, room)  
17. [x] `channels/services/channel_queue.py` — صف، upvote، jump  
18. [x] `support/services/ticket_service.py` — منطق تیکت از `common`  
19. [x] `core/services/webpush`, `accounts/{badge_models,user_badges,premium_limits}`, `support/consumers`  
20. [x] ممیزی ساختار: [structure-audit.md](./structure-audit.md)  

هر PR: move + urls + tests سبز.

### فاز ۳ — Rename و Platform

- [x] `backend-django` → `apps/api`  
- [x] `frontend-next` → `apps/web`  
- [x] `deploy/` + `infra/` + `scripts/` → `platform/` (symlink ریشه برای سازگاری)  
- [x] به‌روزرسانی CI paths (`apps/api`, `apps/web`)  

### فاز ۴ — کیفیت

- [x] `tooling/templates/django-domain` + `make new-domain` / `new-feature`  
- [x] تست نمونه service (`discovery/tests/test_explore_feed.py`)  
- [x] `lib/api/modules/` + alias `@/shared/ui` در tsconfig  
- [x] ESLint هشدار feature↔feature (`.eslintrc.json`)  
- [x] `shared/ui`, `shared/layout`, `shared/hooks` (انتقال فیزیکی + alias)  
- [x] `features/*/index.ts` برای دامنه‌های اصلی  
- [x] OpenAPI codegen — **به‌تعویق** ([ADR-003](./adr/003-openapi-types-deferred.md))  

---

## چک‌لیست Pull Request

قبل از merge:

- [ ] **مرز دامنه** رعایت شده؛ منطق در service/hook نه view/page
- [ ] **Route/Page** فقط wiring است
- [ ] **API** فقط از `lib/api` (بدون `fetch` پراکنده)
- [ ] **i18n** کلید `en` + `fa` اضافه شده
- [ ] **تست** حداقل یک case برای logic جدید (service یا hook یا API)
- [ ] **مستندات** اگر قرارداد WS/API عوض شد → به‌روز `docs/realtime-contracts.md` یا ADR
- [ ] **وابستگی** feature→feature وجود ندارد
- [ ] **Migration** Django اگر model عوض شد
- [ ] **E2E** اگر user journey اصلی touch شد (یا ticket برای follow-up)

---

## پیوست: نگاشت فایل‌های فعلی

### Frontend — مسیر فعلی → هدف

| فعلی | هدف |
|------|-----|
| `apps/web/src/app/` | `apps/web/src/app/` (بدون تغییر نقش) |
| `apps/web/src/features/` | همان + زیرساختار `components/hooks/model` |
| `apps/web/src/components/ui/` | `shared/ui/` |
| `apps/web/src/components/layout/` | `shared/layout/` |
| `apps/web/src/lib/api/` | همان + `types/` + `modules/` |
| `apps/web/src/hooks/` | `shared/hooks/` یا داخل feature |

### Backend — مسیر فعلی → هدف

| فعلی | هدف |
|------|-----|
| `apps/api/apps/channels/` | `domains/channels/` |
| `apps/api/apps/common/discovery_views.py` | `domains/discovery/api/views.py` |
| `apps/api/apps/common/social_expansion_views.py` | `domains/discovery/` + `domains/social/` |
| `apps/api/apps/common/views.py` (auth) | `core/auth/` |
| `apps/api/config/settings.py` | `config/settings/base.py` + env splits |

---

## مراجع داخلی

- [README.md](../README.md) — Quick start و overview
- [realtime-contracts.md](./realtime-contracts.md) — WebSocket
- [production-deployment.md](./production-deployment.md) — Deploy
- [e2e/README.md](../apps/web/e2e/README.md) — تست E2E

---

*این سند با تکامل محصول به‌روز می‌شود. تغییرات ساختاری مهم نیازمند PR جداگانه و در صورت نیاز ADR در `docs/adr/` هستند.*
