# ADR-001: ساختار پروژه و تقسیم domain apps

## Status

Accepted

## Date

2026-05-28

## Context

- Monorepo شامل Django (`backend-django`) و Next.js (`frontend-next`) است.
- اپ `apps/common` مسئولیت‌های متعدد دارد: auth، discovery، social، admin، support، moderation، badges و غیره.
- فرانت‌اند الگوی `features/` را دارد اما همه featureها زیرساخت یکسان (components/hooks/model) ندارند.
- تیم و ابزارهای AI به سند مرجع واحد برای محل قرارگیری کد نیاز دارند.

## Decision

1. سند مرجع: [`docs/project-structure.md`](../project-structure.md).
2. هر domain backend الگوی `models → selectors → services → api` را دنبال می‌کند.
3. هر feature frontend الگوی `features/<name>/{components,hooks,model,index.ts}` را دنبال می‌کند.
4. `apps/common` به‌تدریج به domain apps تقسیم می‌شود (`discovery`, `social`, `accounts`, …) و `core` فقط زیرساخت فنی می‌ماند.
5. rename مسیرهای ریشه (`apps/api`, `apps/web`) اختیاری و در فاز ۳ انجام می‌شود.

## Consequences

### مثبت

- onboarding سریع‌تر؛ مرز review واضح‌تر.
- کاهش coupling و فایل‌های غول‌پیکر.
- هم‌راستایی فرانت و بک با نگاشت domain یکسان.

### منفی

- هزینه migration برای split `common`.
- نیاز به نظارت در PRها تا از بازگشت به الگوی قدیمی جلوگیری شود.

## References

- [project-structure.md](../project-structure.md)
- [CONVENTIONS.md](../CONVENTIONS.md)
