"""Celery tasks for core/async platform operations."""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_webpush_notification(self, user_id: int, title: str, body: str, url: str = "", tag: str = ""):
    """Send web push notification to all subscriptions for a user."""
    try:
        from apps.channels.models import WebPushSubscription
        from apps.core.services.webpush import _send_push_to_subscription

        subs = WebPushSubscription.objects.filter(user_id=user_id)
        for sub in subs:
            try:
                _send_push_to_subscription(sub, title=title, body=body, url=url, tag=tag)
            except Exception as exc:
                logger.warning("Push to %s failed: %s", sub.endpoint[:60], exc)
    except Exception as exc:
        logger.error("send_webpush_notification failed: %s", exc)
        raise self.retry(exc=exc) from exc
