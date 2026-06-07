"""Persist superuser admin actions for compliance and debugging."""

from __future__ import annotations

from typing import Any

from apps.admin_panel.models import PlatformAdminAuditLog


def log_platform_admin_action(
    *,
    actor_id: int | None,
    action: str,
    target_type: str,
    target_id: str | int,
    metadata: dict[str, Any] | None = None,
) -> PlatformAdminAuditLog:
    return PlatformAdminAuditLog.objects.create(
        actor_id=actor_id,
        action=action[:64],
        target_type=target_type[:64],
        target_id=str(target_id)[:64],
        metadata=metadata or {},
    )
