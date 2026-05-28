"""Read-only queries for discovery (explore, search)."""

from __future__ import annotations

from django.db.models import Q

from apps.channels.models import Channel
from apps.playback.models import PlaybackSession


def public_channel_queryset():
    return (
        Channel.objects.filter(is_active=True, privacy=Channel.Privacy.PUBLIC)
        .exclude(Q(name__iexact="E2E") | Q(name__istartswith="E2E Room") | Q(name__istartswith="E2E "))
        .select_related("owner")
    )


def channel_is_live(channel: Channel) -> bool:
    if channel.is_playing:
        return True
    session = PlaybackSession.objects.filter(channel_id=channel.id).only("is_playing").first()
    return bool(session and session.is_playing)


def explore_channel_matches(channel: Channel, *, q: str, lang: str, genre: str) -> bool:
    if q and q not in (channel.name or "").lower():
        return False
    ex = channel.experience if isinstance(channel.experience, dict) else {}
    if lang:
        ch_lang = str(ex.get("language") or ex.get("lang") or "").strip().lower()
        if ch_lang != lang.lower():
            return False
    if genre:
        ch_genre = str(ex.get("genre") or ex.get("music_genre") or "").strip().lower()
        if ch_genre != genre.lower():
            return False
    return True
