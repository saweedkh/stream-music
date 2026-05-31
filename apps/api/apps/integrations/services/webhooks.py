"""Outbound webhook delivery."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import urllib.request
from typing import Any

from django.utils import timezone

from apps.integrations.models import WebhookDeliveryLog, WebhookSubscription

logger = logging.getLogger(__name__)


def dispatch_webhook_event(event: str, payload: dict[str, Any], *, owner_id: int | None = None) -> None:
    qs = WebhookSubscription.objects.filter(is_active=True)
    if owner_id is not None:
        qs = qs.filter(owner_id=owner_id)
    for sub in qs:
        events = sub.events if isinstance(sub.events, list) else []
        if events and event not in events:
            continue
        _deliver_one(sub, event, payload)


def _deliver_one(sub: WebhookSubscription, event: str, payload: dict[str, Any]) -> None:
    body = json.dumps({"event": event, "payload": payload, "sent_at": timezone.now().isoformat()}).encode()
    sig = hmac.new(sub.secret.encode(), body, hashlib.sha256).hexdigest()
    req = urllib.request.Request(
        sub.url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Stream-Music-Event": event,
            "X-Stream-Music-Signature": f"sha256={sig}",
        },
        method="POST",
    )
    ok = False
    status = None
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            status = resp.status
            ok = 200 <= status < 300
    except Exception as exc:
        logger.warning("Webhook %s failed: %s", sub.id, exc)
        sub.last_error = str(exc)[:500]
    else:
        sub.last_error = "" if ok else f"http_{status}"
    sub.last_delivery_at = timezone.now()
    sub.save(update_fields=["last_delivery_at", "last_error"])
    WebhookDeliveryLog.objects.create(
        subscription_id=sub.id, event=event, status_code=status, success=ok
    )
