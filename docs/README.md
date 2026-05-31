# مستندات فنی

این پوشه قراردادهای توسعه و استقرار را نگه می‌دارد. **فهرست فیچرهای محصول** در READMEهای زیر است:

| راهنما | محتوا |
|--------|--------|
| [README.md](../README.md) | **کل پروژه** — جدول فیچرها، مسیرهای UI، شروع سریع |
| [apps/web/README.md](../apps/web/README.md) | **فرانت‌اند** — فیچرها، مسیرها، `lib/api` |
| [apps/api/README.md](../apps/api/README.md) | **بک‌اند** — اپ‌های Django و endpointها |

---

## اسناد این پوشه (`docs/`)

| سند | موضوع |
|-----|--------|
| [architecture.md](./architecture.md) | ساختار پوشه‌ها، import، تست |
| [CONVENTIONS.md](./CONVENTIONS.md) | lint، commit، pre-commit، امنیت |
| [production-deployment.md](./production-deployment.md) | استقرار پروداکشن |
| [realtime-contracts.md](./realtime-contracts.md) | قرارداد رویدادهای WebSocket |

---

## دستورات پرکاربرد

```bash
make ensure-env && make dev          # محیط و اجرای توسعه
make check-quality && make test-api  # کیفیت و تست بک
make openapi-export                  # snapshot API برای فرانت
```

---

## راهنمای عامل (Cursor)

[AGENTS.md](../AGENTS.md) — ارجاع به همین اسناد و قوانین در `.cursor/rules/project-agent.mdc`
