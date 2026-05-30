"""Persist playback events for channel history."""

from apps.playback.models import PlaybackEvent
from apps.tracks.models import Track


def record_playback_event(
    channel_id: int,
    event_type: str,
    *,
    actor_id: int | None,
    track: Track | None,
    source: str = "manual",
    payload: dict | None = None,
) -> None:
    PlaybackEvent.objects.create(
        channel_id=channel_id,
        actor_id=actor_id,
        track=track,
        event_type=event_type,
        source=source,
        payload=payload or {},
    )
