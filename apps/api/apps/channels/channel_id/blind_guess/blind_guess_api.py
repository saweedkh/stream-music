"""Blind listening guesses and scoring."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.services.gamification import add_points
from apps.analytics.models import GamificationPointEvent
from apps.channels.models import Channel, ChannelBlindGuess, ChannelMembership
from apps.tracks.models import Track


def _score_guess(guess: str, track: Track) -> int:
    g = guess.strip().lower()
    title = (track.title or "").strip().lower()
    artist = (track.artist or "").strip().lower()
    if not g or not title:
        return 0
    if g == title or g == f"{artist} - {title}":
        return 100
    if title in g or g in title:
        return 60
    if artist and artist in g:
        return 30
    return 0


class ChannelBlindGuessView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        track_id = request.query_params.get("track_id")
        qs = ChannelBlindGuess.objects.filter(channel_id=channel_id).select_related("user", "track")
        if track_id:
            qs = qs.filter(track_id=int(track_id))
        rows = qs.order_by("-score", "-created_at")[:50]
        return Response(
            {
                "results": [
                    {
                        "id": r.id,
                        "user_id": r.user_id,
                        "username": getattr(r.user, "username", ""),
                        "track_id": r.track_id,
                        "guess_text": r.guess_text,
                        "score": r.score,
                        "revealed_at": r.revealed_at.isoformat() if r.revealed_at else None,
                    }
                    for r in rows
                ]
            }
        )

    def post(self, request, channel_id: int):
        if not ChannelMembership.objects.filter(
            channel_id=channel_id, user=request.user, is_active=True
        ).exists():
            return Response({"detail": "not_a_member"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.data.get("track_id")
        guess_text = str(request.data.get("guess") or "").strip()[:255]
        if not track_id or not guess_text:
            return Response({"detail": "invalid_payload"}, status=status.HTTP_400_BAD_REQUEST)
        track = get_object_or_404(Track, id=int(track_id))
        channel = get_object_or_404(Channel, id=channel_id)
        ex = channel.experience if isinstance(channel.experience, dict) else {}
        if not ex.get("blind_playlist_id"):
            return Response({"detail": "blind_mode_off"}, status=status.HTTP_400_BAD_REQUEST)
        row, created = ChannelBlindGuess.objects.update_or_create(
            channel_id=channel_id,
            user_id=request.user.id,
            track_id=track.id,
            defaults={"guess_text": guess_text},
        )
        reveal = bool(request.data.get("reveal"))
        if reveal and (channel.owner_id == request.user.id or request.user.is_staff):
            score = _score_guess(row.guess_text, track)
            row.score = score
            row.revealed_at = timezone.now()
            row.save(update_fields=["score", "revealed_at"])
            if score >= 60:
                add_points(
                    row.user_id,
                    score // 10,
                    GamificationPointEvent.Reason.BLIND_GUESS,
                    channel_id=channel_id,
                )
        return Response(
            {
                "id": row.id,
                "guess_text": row.guess_text,
                "score": row.score,
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
