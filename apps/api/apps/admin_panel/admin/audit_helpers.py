"""Log superuser admin mutations."""

from __future__ import annotations

from typing import Any


def log_admin_action(request, action: str, target_type: str, target_id: str | int, metadata: dict[str, Any] | None = None) -> None:
    from apps.admin_panel.services.audit_log import log_platform_admin_action

    actor_id = getattr(getattr(request, "user", None), "id", None)
    log_platform_admin_action(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata or {},
    )
