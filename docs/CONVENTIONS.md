# قراردادهای توسعه — Stream Music

این سند مکمل [project-structure.md](./project-structure.md) است و قوانین عملیاتی روزمره (کد، Git، lint، review) را خلاصه می‌کند.

---

## 1. زبان و سبک

| لایه | ابزار | دستور |
|------|--------|--------|
| Python | Ruff | `cd apps/api && ruff check .` |
| TypeScript | ESLint + `tsc` | `cd apps/web && npm run lint` |
| Format | Prettier (frontend) | طبق `package.json` |

قبل از PR هر دو lint باید سبز باشند (مطابق CI).

دستور یکجا (نزدیک CI):

```bash
make check-quality    # lint + ruff format --check + tsc
make pre-commit       # همه hookهای pre-commit
```

---

## 2. Commits

- پیام به **انگلیسی** یا **فارسی** یکدست در همان PR؛ ترجیح: انگلیسی برای تاریخچه جهانی.
- فرمت پیشنهادی (Conventional Commits):

```text
feat(discovery): add explore channel follow controls
fix(playback): correct queue advance on empty track
docs: add project structure guide
refactor(common): extract explore feed to discovery domain
test(e2e): cover explore follow channel UI
```

- scopeهای رایج: `channels`, `playback`, `discovery`, `auth`, `deploy`, `e2e`.

---

## 3. Pull Request

- یک PR = یک موضوع قابل review (ترجیحاً < 400 خط منطقی).
- توضیح PR: **چرا** + **چطور تست شد**.
- از [چک‌لیست project-structure](./project-structure.md#چک‌لیست-pull-request) استفاده کنید.
- بدون commit فایل‌های `.env`، کلید VAPID production، backup، `media/`.

---

## 4. شاخه‌ها

```text
main              # production-ready
feature/<name>    # توسعه
fix/<name>        # رفع باگ
docs/<name>       # فقط مستندات
```

---

## 5. کد Python (Django)

- Viewها نازک؛ logic در `services/`.
- Query در `selectors/`؛ از N+1 با `select_related` / `prefetch_related` جلوگیری شود.
- Transaction برای عملیات چندمرحله‌ای: `@transaction.atomic`.
- Type hints در service و selector جدید ترجیح داده می‌شود.

### 5.1 HTTP handlers (URL-mirror)

- پوشه‌ها منطبق بر segmentهای مسیر API (بدون `/api/`): `auth/me/password/` برای `auth/me/password`.
- فایل view: `<endpoint>_api.py`؛ serializer همان endpoint: `<endpoint>_serializers.py`.
- Routeها در `apps/<domain>/urls/` — نه در پکیج `api/`.
- جزئیات: [project-structure.md](./project-structure.md#الگوی-ثابت-هر-domain-app).
- CRUD: `generics.ListCreateAPIView` / `RetrieveUpdateDestroyAPIView` — **نه** `ModelViewSet` و **نه** `DefaultRouter`.
- اکشن‌های سفارشی: `generics.GenericAPIView` یا `APIView` در پوشه leaf همان URL.

---

## 6. کد TypeScript (Next.js)

- `"use client"` فقط where needed.
- Props type با `type` (نه `interface` مگر convention فایل خلافش باشد).
- Import alias: `@/` مطابق `tsconfig`.
- بدون `any` جدید بدون توجیه.

---

## 7. امنیت

- هرگز secret در repo.
- `credentials: "include"` برای API احراز هویت‌شده.
- ورودی کاربر در URL: `encodeURIComponent`.

---

## 8. زنجیره کیفیت کد (Quality toolchain)

### 8.1 ابزارها

| لایه | ابزار | محل اجرا | دستور |
|------|--------|----------|--------|
| Python lint | Ruff | CI + local + pre-commit | `cd apps/api && ruff check .` |
| Python format | Ruff format | CI + pre-commit | `ruff format --check .` |
| Python types | BasedPyright | IDE (اختیاری) | `pyrightconfig.json` |
| Python stubs | django-stubs, drf-stubs | IDE | `pip install -r apps/api/requirements-dev.txt` |
| Django | `manage.py check` | CI | `python manage.py check` |
| Backend tests | Django TestCase | CI | `python manage.py test` |
| TS lint | ESLint (`next lint`) | CI + pre-commit | `cd apps/web && npm run lint` |
| TS types | `tsc --noEmit` | CI + pre-commit | `npx tsc --noEmit` |
| Frontend unit | Vitest | local | `cd apps/web && npm test` |
| E2E | Playwright | CI | `npx playwright test` |

پیکربندی Ruff: `apps/api/pyproject.toml`. CI: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### 8.2 pre-commit (قبل از هر commit)

نصب یک‌بار:

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
cd ../..
make pre-commit-install
```

Hookها (فایل [`.pre-commit-config.yaml`](../.pre-commit-config.yaml)):

- trailing whitespace، merge conflict، کلید خصوصی
- **Ruff** lint + format روی `apps/api/` (بدون `--fix` خودکار؛ اصلاح: `ruff check --fix .`)
- **ESLint** و **tsc** روی `apps/web/` (نیاز به `npm ci` در `apps/web`)

اجرای دستی:

```bash
make pre-commit
```

### 8.4 Docker Compose و env

- Dev: `docker-compose.yml` از `apps/api/.env` و `apps/web/.env.local` استفاده می‌کند (`make ensure-env` در صورت نبود از `.env.example` کپی می‌کند).
- Production: `docker-compose.prod.yml` → `deploy/.env.runtime.merged` (جدا از dev).

### 8.5 چک‌لیست قبل از PR

```bash
make check-quality
make test              # در صورت دسترسی به Postgres/Redis
# اختیاری: make test-e2e
```

---

## 9. مستندات

- تغییر ساختار → به‌روز `docs/project-structure.md`.
- تصمیم معماری → `docs/adr/NNN-*.md`.
- endpoint/WS جدید → README API table یا `realtime-contracts.md`.

---

*نسخه 1.1 — 2026-05-28*
