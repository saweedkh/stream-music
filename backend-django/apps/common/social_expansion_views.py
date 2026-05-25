"""Following feed, explore, user follow, queue import, session export."""

from __future__ import annotations

import re
from collections import Counter
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership, ChannelPlaylistSuggestion
from apps.common.favorites import UserPlaylistFavorite
from apps.common.party_recap import build_party_recap
from apps.common.serializers import ChannelSerializer, PlaylistItemSerializer, PlaylistSerializer, QueueItemSerializer, TrackSerializer
from apps.common.social_models import ChannelFollow, PlaylistShareLink, UserFollow, UserPublicProfile
from apps.common.user_badges import badges_for_user
from apps.common.views import _can_manage_channel, _serialize_queue
from apps.playback.models import PlaybackEvent, PlaybackSession
from apps.playback.services.channel_queue import replace_queue_with_tracks, tracks_accessible_to_user
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track

_SPOTIFY_RE = re.compile(r"(?:open\.)?spotify\.com/(?:track|album|playlist)/", re.I)
_YOUTUBE_RE = re.compile(r"(?:youtube\.com/watch|youtu\.be/)", re.I)


def _public_channel_qs():
    return (
        Channel.objects.filter(is_active=True, privacy=Channel.Privacy.PUBLIC)
        .exclude(Q(name__iexact="E2E") | Q(name__istartswith="E2E Room") | Q(name__istartswith="E2E "))
        .select_related("owner")
    )


def _channel_live(channel: Channel) -> bool:
    if channel.is_playing:
        return True
    session = PlaybackSession.objects.filter(channel_id=channel.id).only("is_playing").first()
    return bool(session and session.is_playing)


def _parse_external_source(url: str) -> tuple[str, str, str, str]:
    raw = (url or "").strip()
    if not raw:
        return "", "", "", ""
    source = ""
    if _SPOTIFY_RE.search(raw):
        source = "spotify"
    elif _YOUTUBE_RE.search(raw):
        source = "youtube"
    else:
        source = "link"
    title = str(raw).split("/")[-1].split("?")[0][:255] or "External link"
    return raw[:500], title, "", source


class FollowingChannelsFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = (
            ChannelFollow.objects.filter(user_id=request.user.id)
            .select_related("channel", "channel__owner")
            .order_by("-created_at")[:100]
        )
        member_channel_ids = set(
            ChannelMembership.objects.filter(user_id=request.user.id, is_active=True).values_list("channel_id", flat=True)
        )
        results = []
        for follow in rows:
            ch = follow.channel
            if not ch.is_active:
                continue
            results.append(
                {
                    "channel": ChannelSerializer(ch, context={"request": request}).data,
                    "notify_live": follow.notify_live,
                    "is_live": _channel_live(ch),
                    "is_member": ch.id in member_channel_ids,
                    "followed_at": follow.created_at.isoformat() if follow.created_at else None,
                }
            )
        results.sort(key=lambda r: (not r["is_live"], r["channel"]["name"]))
        return Response({"results": results})


def _explore_channel_matches(ch: Channel, *, q: str, lang: str, genre: str) -> bool:
    if q and q not in (ch.name or "").lower():
        return False
    ex = ch.experience if isinstance(ch.experience, dict) else {}
    if lang:
        ch_lang = str(ex.get("language") or ex.get("lang") or "").strip().lower()
        if ch_lang != lang.lower():
            return False
    if genre:
        ch_genre = str(ex.get("genre") or ex.get("music_genre") or "").strip().lower()
        if ch_genre != genre.lower():
            return False
    return True


class ExploreFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = str(request.query_params.get("q") or "").strip().lower()
        lang = str(request.query_params.get("lang") or "").strip()
        genre = str(request.query_params.get("genre") or "").strip()
        live_only = str(request.query_params.get("live_only") or "").lower() in {"1", "true", "yes"}

        live = []
        for ch in _public_channel_qs().order_by("-updated_at")[:80]:
            if not _explore_channel_matches(ch, q=q, lang=lang, genre=genre):
                continue
            if _channel_live(ch):
                live.append(ChannelSerializer(ch, context={"request": request}).data)
        if live_only:
            return Response({"live_channels": live, "popular_channels": [], "shared_playlists": []})
        week_ago = timezone.now() - timedelta(days=7)
        event_counts = (
            PlaybackEvent.objects.filter(
                channel__privacy=Channel.Privacy.PUBLIC,
                channel__is_active=True,
                emitted_at__gte=week_ago,
                track_id__isnull=False,
            )
            .values("channel_id")
            .annotate(n=Count("id"))
            .order_by("-n")[:12]
        )
        popular_ids = [row["channel_id"] for row in event_counts]
        popular_map = {c.id: c for c in _public_channel_qs().filter(id__in=popular_ids)}
        popular = []
        for cid in popular_ids:
            ch = popular_map.get(cid)
            if ch and _explore_channel_matches(ch, q=q, lang=lang, genre=genre):
                popular.append(
                    {
                        "channel": ChannelSerializer(ch, context={"request": request}).data,
                        "event_count": next(r["n"] for r in event_counts if r["channel_id"] == cid),
                    }
                )
        share_links = (
            PlaylistShareLink.objects.filter(is_active=True, privacy=PlaylistShareLink.Privacy.PUBLIC)
            .select_related("playlist", "playlist__owner")
            .order_by("-created_at")[:24]
        )
        shared_playlists = []
        for link in share_links:
            if link.expires_at and link.expires_at < timezone.now():
                continue
            pl = link.playlist
            if pl.channel_id is not None:
                continue
            shared_playlists.append(
                {
                    "token": str(link.token),
                    "share_url": f"/share/playlist/{link.token}",
                    "playlist": PlaylistSerializer(pl, context={"request": request}).data,
                    "owner_username": pl.owner.username,
                    "item_count": PlaylistItem.objects.filter(playlist=pl).count(),
                }
            )
        return Response(
            {
                "live_channels": live,
                "popular_channels": popular,
                "shared_playlists": shared_playlists,
            }
        )


class UserFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username: str):
        target = User.objects.filter(username__iexact=username).first()
        if target is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        row = UserFollow.objects.filter(follower_id=request.user.id, following_id=target.id).first()
        follower_count = UserFollow.objects.filter(following_id=target.id).count()
        return Response(
            {
                "following": row is not None,
                "follower_count": follower_count,
                "following_count": UserFollow.objects.filter(follower_id=target.id).count(),
            }
        )

    def post(self, request, username: str):
        target = get_object_or_404(User, username__iexact=username)
        if target.id == request.user.id:
            return Response({"detail": "cannot_follow_self"}, status=status.HTTP_400_BAD_REQUEST)
        profile, _ = UserPublicProfile.objects.get_or_create(user_id=target.id)
        if not profile.is_public:
            return Response({"detail": "profile_private"}, status=status.HTTP_403_FORBIDDEN)
        UserFollow.objects.get_or_create(follower_id=request.user.id, following_id=target.id)
        return Response({"following": True}, status=status.HTTP_201_CREATED)

    def delete(self, request, username: str):
        target = get_object_or_404(User, username__iexact=username)
        UserFollow.objects.filter(follower_id=request.user.id, following_id=target.id).delete()
        return Response({"following": False})


class ChannelQueueImportShareView(APIView):
    """Append tracks from a shared playlist token to the channel queue."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        token = (request.data.get("share_token") or "").strip()
        if not token:
            return Response({"detail": "share_token_required"}, status=status.HTTP_400_BAD_REQUEST)
        link = PlaylistShareLink.objects.filter(token=token, is_active=True).select_related("playlist").first()
        if not link:
            return Response({"detail": "invalid_share"}, status=status.HTTP_404_NOT_FOUND)
        if link.expires_at and link.expires_at < timezone.now():
            return Response({"detail": "share_expired"}, status=status.HTTP_410_GONE)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_410_GONE)
        src_items = PlaylistItem.objects.filter(playlist=link.playlist).select_related("track").order_by("position", "id")
        tracks = [item.track for item in src_items if item.track_id]
        if not tracks:
            return Response({"detail": "empty_playlist"}, status=status.HTTP_400_BAD_REQUEST)
        existing = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
        start_pos = len(existing)
        new_rows = [
            ChannelQueueItem(channel=channel, track=t, position=start_pos + i, added_by_id=request.user.id)
            for i, t in enumerate(tracks)
        ]
        ChannelQueueItem.objects.bulk_create(new_rows)
        session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        session.queue_version += 1
        session.save(update_fields=["queue_version", "updated_at"])
        serialized = _serialize_queue(channel_id, request.user.id)
        return Response({"added": len(new_rows), "results": serialized})


class ChannelSessionExportPlaylistView(APIView):
    """Export recent playback history into a new personal or channel playlist."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        name = str(request.data.get("name") or f"{channel.name} session").strip()[:255]
        dest_channel = request.data.get("save_to_channel")
        playlist_channel_id = channel_id if dest_channel else None
        recap = build_party_recap(channel, limit=120)
        track_ids = []
        seen = set()
        for row in recap.get("top_tracks") or []:
            tid = row.get("id")
            if tid and tid not in seen:
                seen.add(tid)
                track_ids.append(tid)
        for row in reversed(recap.get("timeline") or []):
            tid = row.get("track_id")
            if tid and tid not in seen:
                seen.add(tid)
                track_ids.append(tid)
        if not track_ids:
            return Response({"detail": "no_tracks"}, status=status.HTTP_400_BAD_REQUEST)
        dest = Playlist.objects.create(name=name, owner=request.user, channel_id=playlist_channel_id)
        tracks = Track.objects.filter(id__in=track_ids)
        track_map = {t.id: t for t in tracks}
        for i, tid in enumerate(track_ids):
            t = track_map.get(tid)
            if t:
                PlaylistItem.objects.create(playlist=dest, track=t, position=i)
        return Response({"playlist": PlaylistSerializer(dest, context={"request": request}).data}, status=status.HTTP_201_CREATED)
