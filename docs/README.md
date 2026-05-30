# مستندات Stream Music

راهنمای رسمی توسعه، استقرار و قراردادهای فنی. برای شروع سریع از [README.md](../README.md) استفاده کنید.

## اسناد اصلی

| سند | مخاطب | محتوا |
|-----|--------|--------|
| [project-structure.md](./project-structure.md) | همه توسعه‌دهندگان | معماری monorepo، چیدمان بک/فرانت، قوانین import، چک‌لیست PR |
| [CONVENTIONS.md](./CONVENTIONS.md) | روزمره | lint، commit، pre-commit، امنیت |
| [api-endpoints.md](./api-endpoints.md) | فرانت / یکپارچه‌سازی | مرور REST API و OpenAPI snapshot |
| [realtime-contracts.md](./realtime-contracts.md) | playback / chat | رویدادهای WebSocket |
| [production-deployment.md](./production-deployment.md) | DevOps | Docker prod، TLS، env، عیب‌یابی |

## راهنماهای موضوعی

| سند | محتوا |
|-----|--------|
| [import-audio-cli.md](./import-audio-cli.md) | import انبوه ترک از دیسک |
| [capacitor-native-app.md](./capacitor-native-app.md) | اپ Android/iOS با Capacitor |
| [apps/web/e2e/README.md](../apps/web/e2e/README.md) | Playwright و stack E2E |

## تصمیم‌های معماری (ADR)

| ADR | موضوع |
|-----|--------|
| [001](./adr/001-project-structure-and-domain-split.md) | تفکیک دامنه و ساختار monorepo |
| [002](./adr/002-discovery-and-social-apps.md) | اپ‌های discovery و social |
| [003](./adr/003-common-migration-shim.md) | `apps.common` فقط برای migration |
| [004](./adr/004-api-contract-snapshot.md) | قرارداد OpenAPI و تایپ‌های فرانت |

قالب جدید: [adr/000-template.md](./adr/000-template.md).

## مسیرهای کمکی در repo

| مسیر | توضیح |
|------|--------|
| [platform/deploy/README.md](../platform/deploy/README.md) | اسکریپت‌های `up.sh` / env |
| [platform/README.md](../platform/README.md) | deploy، infra، scripts |
| [AGENTS.md](../AGENTS.md) | قوانین Cursor Agent |
| `.cursor/rules/project-agent.mdc` | خلاصه قوانین برای AI |

## دستورات پرکاربرد

```bash
make ensure-env
make dev                    # Docker dev stack
make check-quality          # lint + format + tsc
make test-api               # Django tests (Postgres local)
make openapi-export         # snapshot + schema-paths.ts
make pre-commit-install     # یک‌بار per machine
```

---

*اسناد موقت ممیزی مهاجرت حذف شده‌اند؛ وضعیت فعلی در `project-structure.md` و ADRها ثبت می‌شود.*
