"""Channel audit log writes."""

from apps.channels.models import ChannelAuditLog


def log_channel_audit(
    channel_id: int,
    action: str,
    actor_id: int | None,
    *,
    target_type: str = "",
    target_id: str = "",
    metadata=None,
) -> None:
    ChannelAuditLog.objects.create(
        channel_id=channel_id,
        actor_id=actor_id,
        action=action,
        target_type=target_type or "",
        target_id=str(target_id or ""),
        metadata=metadata if isinstance(metadata, dict) else {},
    )
