"""Read-only track library queries."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.db.models import Q, QuerySet

from apps.accounts.user_badges import is_platform_superuser
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.tracks.models import Track


def tracks_list_queryset(user: AbstractBaseUser, query_params) -> QuerySet[Track]:
    if is_platform_superuser(user):
        qs = Track.objects.select_related("owner").order_by("title", "id")
    else:
        qs = tracks_accessible_to_user(user).order_by("title", "id")
    search = (query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(title__icontains=search)
            | Q(artist__icontains=search)
            | Q(album__icontains=search)
            | Q(genre__icontains=search)
        )
    genre = (query_params.get("genre") or "").strip()
    if genre:
        qs = qs.filter(genre__iexact=genre)
    album = (query_params.get("album") or "").strip()
    if album:
        qs = qs.filter(album__iexact=album)
    tag = (query_params.get("tag") or "").strip()
    if tag:
        qs = qs.filter(tags__contains=[tag])
    fav = (query_params.get("favorited") or "").strip().lower()
    if fav in ("1", "true", "yes"):
        qs = qs.filter(favorited_by__user=user).distinct()
    return qs
