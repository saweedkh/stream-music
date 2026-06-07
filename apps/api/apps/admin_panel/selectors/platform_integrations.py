"""Integrations admin queries."""

from __future__ import annotations

from django.db.models import Q

from apps.admin_panel.selectors.date_range import filter_created_at
from apps.integrations.models import UserApiToken, WebhookDeliveryLog, WebhookSubscription


def build_integrations_overview() -> dict:
    return {
        "webhooks_total": WebhookSubscription.objects.count(),
        "webhooks_active": WebhookSubscription.objects.filter(is_active=True).count(),
        "deliveries_total": WebhookDeliveryLog.objects.count(),
        "deliveries_failed": WebhookDeliveryLog.objects.filter(success=False).count(),
        "api_tokens_total": UserApiToken.objects.count(),
        "api_tokens_active": UserApiToken.objects.filter(is_active=True).count(),
    }


def list_webhook_subscriptions(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = WebhookSubscription.objects.select_related("owner").order_by("-created_at")
    if search:
        qs = qs.filter(Q(owner__username__icontains=search) | Q(url__icontains=search))
    total = qs.count()
    results = []
    for row in qs[offset : offset + limit]:
        results.append(
            {
                "id": row.id,
                "owner_id": row.owner_id,
                "owner_username": row.owner.username,
                "url": row.url,
                "events": row.events,
                "is_active": row.is_active,
                "last_delivery_at": row.last_delivery_at.isoformat() if row.last_delivery_at else None,
                "last_error": row.last_error,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return results, total


def list_webhook_deliveries(
    *,
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    qs = filter_created_at(
        WebhookDeliveryLog.objects.select_related("subscription", "subscription__owner").order_by("-created_at"),
        date_from=date_from,
        date_to=date_to,
    )
    if search:
        qs = qs.filter(
            Q(subscription__owner__username__icontains=search)
            | Q(event__icontains=search)
            | Q(subscription__url__icontains=search)
        )
    total = qs.count()
    results = []
    for row in qs[offset : offset + limit]:
        sub = row.subscription
        results.append(
            {
                "id": row.id,
                "subscription_id": sub.id,
                "owner_username": sub.owner.username if sub.owner_id else None,
                "url": sub.url,
                "event": row.event,
                "status_code": row.status_code,
                "success": row.success,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return results, total


def export_webhook_deliveries(*, search: str = "", date_from: str = "", date_to: str = "", limit: int = 5000) -> list[list]:
    rows, _ = list_webhook_deliveries(search=search, date_from=date_from, date_to=date_to, offset=0, limit=limit)
    return [
        [
            row["id"],
            row["subscription_id"],
            row["owner_username"] or "",
            row["url"],
            row["event"],
            row["status_code"] if row["status_code"] is not None else "",
            "yes" if row["success"] else "no",
            row["created_at"] or "",
        ]
        for row in rows
    ]


def list_api_tokens(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = UserApiToken.objects.select_related("user").order_by("-created_at")
    if search:
        qs = qs.filter(Q(user__username__icontains=search) | Q(name__icontains=search))
    total = qs.count()
    results = [
        {
            "id": row.id,
            "user_id": row.user_id,
            "username": row.user.username,
            "name": row.name,
            "token_prefix": row.token_prefix,
            "scopes": row.scopes,
            "is_active": row.is_active,
            "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in qs[offset : offset + limit]
    ]
    return results, total
