# مستندات

| سند | برای چه کسی | محتوا |
|-----|-------------|--------|
| [architecture.md](./architecture.md) | توسعه‌دهنده | ساختار repo، بک/فرانت، دامنه‌ها، import audio، Capacitor |
| [CONVENTIONS.md](./CONVENTIONS.md) | روزمره | lint، commit، pre-commit، PR |
| [production-deployment.md](./production-deployment.md) | DevOps | Docker prod، TLS، env |
| [realtime-contracts.md](./realtime-contracts.md) | playback / chat | قرارداد WebSocket |

شروع سریع پروژه: [README.md](../README.md).

```bash
make ensure-env && make dev
make check-quality && make test-api
make openapi-export    # به‌روز snapshot API
```

Agent / Cursor: [AGENTS.md](../AGENTS.md) و `.cursor/rules/project-agent.mdc`.
