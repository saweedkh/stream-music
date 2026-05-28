# قراردادهای توسعه — Stream Music

این سند مکمل [project-structure.md](./project-structure.md) است و قوانین عملیاتی روزمره (کد، Git، lint، review) را خلاصه می‌کند.

---

## 1. زبان و سبک

| لایه | ابزار | دستور |
|------|--------|--------|
| Python | Ruff | `cd backend-django && ruff check .` |
| TypeScript | ESLint + `tsc` | `cd frontend-next && npm run lint` |
| Format | Prettier (frontend) | طبق `package.json` |

قبل از PR هر دو lint باید سبز باشند (مطابق CI).

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

## 8. مستندات

- تغییر ساختار → به‌روز `docs/project-structure.md`.
- تصمیم معماری → `docs/adr/NNN-*.md`.
- endpoint/WS جدید → README API table یا `realtime-contracts.md`.

---

*نسخه 1.0 — 2026-05-28*
