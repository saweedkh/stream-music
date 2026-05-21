import json
import math
import random
import time
from collections import defaultdict

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import User

from apps.channels.models import Channel, ChannelMembership, ChannelPlaylistSuggestion
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.services.channel_queue import (
    MAX_SHUFFLE_TRACKS,
    apply_track_to_session,
    pick_shuffled_tracks,
    replace_queue_with_tracks,
)
from apps.playback.services.queue_advance import (
    apply_queue_advance,
    clear_active_playlist,
    playback_queue_meta,
    scheduled_start_blocks_playback,
    set_active_playlist,
    set_playback_source,
)
from apps.playback.services.state_store import playback_state_store
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track


def _notify_channel_staff_webpush(channel_id: int, action: str, payload: dict, actor_user_id: int) -> None:
    from apps.common.webpush_service import notify_channel_staff_social_push

    notify_channel_staff_social_push(channel_id, action, payload, actor_user_id)


def _maybe_notify_track_changed_push(channel_id: int, payload: dict, actor_user_id: int | None) -> None:
    from apps.common.webpush_service import notify_channel_track_changed_push

    action = str(payload.get("action") or "").lower()
    track = payload.get("track") if isinstance(payload.get("track"), dict) else {}
    title = str(track.get("title") or "").strip()
    if not title:
        raw = str(payload.get("track_file") or "")
        if raw:
            title = raw.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    notify_channel_track_changed_push(
        channel_id,
        track_title=title or "Track",
        actor_user_id=actor_user_id,
        action=action,
    )


# In-process presence / social (single worker; use Redis if you scale horizontally).
_PRESENCE: dict[int, dict[int, float]] = defaultdict(dict)
_SHOUT_COOLDOWN: dict[int, dict[int, float]] = defaultdict(dict)
_SKIP_VOTES: dict[tuple[int, int], set[int]] = {}


def _touch_presence(channel_id: int, user_id: int) -> None:
    playback_state_store.touch_presence(channel_id, user_id)
    _PRESENCE[channel_id][user_id] = time.monotonic()


def _clear_presence(channel_id: int, user_id: int) -> None:
    playback_state_store.clear_presence(channel_id, user_id)
    _PRESENCE[channel_id].pop(user_id, None)


def _presence_snapshot(channel_id: int) -> tuple[list[dict], int]:
    redis_uids = playback_state_store.presence_user_ids(channel_id)
    if redis_uids:
        names: dict[int, str] = {}
        for u in User.objects.filter(id__in=redis_uids).only("id", "username"):
            names[u.id] = u.username
        members = [{"id": uid, "username": names.get(uid, "?")} for uid in redis_uids]
        return members, len(redis_uids)
    now = time.monotonic()
    bucket = _PRESENCE.get(channel_id, {})
    stale = [uid for uid, ts in bucket.items() if now - ts > 45]
    for uid in stale:
        bucket.pop(uid, None)
    uids = list(bucket.keys())[:32]
    names: dict[int, str] = {}
    if uids:
        for u in User.objects.filter(id__in=uids).only("id", "username"):
            names[u.id] = u.username
    members = [{"id": uid, "username": names.get(uid, "?")} for uid in uids]
    return members, len(bucket)


class ChannelPlaybackConsumer(AsyncWebsocketConsumer):
    @staticmethod
    def _incoming_action_text(raw) -> str | None:
        """Accept only JSON string actions after trim (avoids accidental non-string types)."""
        if not isinstance(raw, str):
            return None
        text = raw.strip()
        return text or None

    @staticmethod
    def _serialize_queue_rows(queue_rows: list[ChannelQueueItem]) -> list[dict]:
        return [
            {
                "id": row.id,
                "channel": row.channel_id,
                "track": row.track_id,
                "position": row.position,
                "added_by": row.added_by_id,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in queue_rows
        ]

    @staticmethod
    def _normalize_action(action: str | None) -> str | None:
        if action is None:
            return None
        value = action.strip().lower()
        if value in {
            "play",
            "pause",
            "seek",
            "next",
            "prev",
            "play_playlist",
            "shuffle_play",
            "add_to_queue",
            "enqueue_next",
            "auto_next",
            "blind_draw",
        }:
            return value
        return None

    async def connect(self):
        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]

        @sync_to_async
        def channel_is_open() -> bool:
            try:
                ch = Channel.objects.only("is_active").get(id=int(self.channel_id))
            except (Channel.DoesNotExist, ValueError, TypeError):
                return False
            return bool(ch.is_active)

        if not await channel_is_open():
            await self.close(code=4404)
            return

        self.group_name = f"channel_{self.channel_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        user = self.scope.get("user")
        if getattr(user, "is_authenticated", False):
            await sync_to_async(_touch_presence)(int(self.channel_id), user.id)
        initial_payload = await self._build_initial_sync_payload()
        await self.send(text_data=json.dumps(initial_payload))

    async def disconnect(self, close_code):
        user = self.scope.get("user")
        if getattr(user, "is_authenticated", False):
            await sync_to_async(_clear_presence)(int(self.channel_id), user.id)
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "invalid_json"}))
            return
        if not isinstance(data, dict):
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "invalid_action"}))
            return
        raw_action = data.get("action")
        action_text = self._incoming_action_text(raw_action)
        if action_text and action_text.upper() == "PING_LATENCY":
            await self.send(
                text_data=json.dumps(
                    {"type": "PONG_LATENCY", "client_ts": data.get("client_ts"), "server_time": time.time()},
                ),
            )
            return

        user = self.scope.get("user")
        if action_text and action_text.strip().lower() == "resync":
            if not getattr(user, "is_authenticated", False):
                await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
                return
            allowed = await sync_to_async(ChannelPlaybackConsumer._active_member)(int(self.channel_id), user.id)
            if not allowed:
                await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
                return
            initial_payload = await self._build_initial_sync_payload()
            await self.send(text_data=json.dumps(initial_payload))
            return
        at_low = (action_text or "").strip().lower()
        if at_low in {"presence_ping", "reaction", "shout", "vote_skip"}:
            if not getattr(user, "is_authenticated", False):
                await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
                return
            allowed = await sync_to_async(ChannelPlaybackConsumer._active_member)(int(self.channel_id), user.id)
            if not allowed:
                await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
                return
            payload = await sync_to_async(ChannelPlaybackConsumer._apply_social)(at_low, int(self.channel_id), user, data)
            if payload is None:
                return
            if payload.get("type") == "ERROR":
                await self.send(text_data=json.dumps(payload))
                return
            next_payload = payload.pop("_next_playback_payload", None)
            await self._fanout_playback(payload, actor_user_id=getattr(user, "id", None))
            if next_payload:
                await self._fanout_playback(next_payload, actor_user_id=getattr(user, "id", None))
            act = str(payload.get("action") or "").lower()
            if act in {"reaction", "vote_skip"}:
                push_payload = {k: v for k, v in payload.items() if not str(k).startswith("_")}
                await sync_to_async(_notify_channel_staff_webpush)(int(self.channel_id), act, push_payload, user.id)
            return

        action = self._normalize_action(action_text)
        if action is None:
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "invalid_action"}))
            return

        if action == "auto_next":
            if not getattr(user, "is_authenticated", False):
                await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
                return
            payload = await sync_to_async(self._apply_auto_next)(user.id, data)
            if payload is None:
                return
            if payload.get("type") == "ERROR":
                await self.send(text_data=json.dumps(payload))
                return
            await self._fanout_playback(payload, actor_user_id=getattr(user, "id", None))
            return

        has_permission = await sync_to_async(can_control_channel)(user, int(self.channel_id))
        if not has_permission:
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
            return

        payload = await self._apply_action(action=action, data=data, user_id=getattr(user, "id", None))
        if payload is None:
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "invalid_state"}))
            return
        if payload.get("type") == "ERROR":
            await self.send(text_data=json.dumps(payload))
            return
        await self._fanout_playback(payload, actor_user_id=getattr(user, "id", None))

    async def broadcast_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def _fanout_playback(self, payload: dict, *, actor_user_id: int | None = None) -> None:
        await self.channel_layer.group_send(self.group_name, {"type": "broadcast_event", "payload": payload})
        await sync_to_async(_maybe_notify_track_changed_push)(int(self.channel_id), payload, actor_user_id)

    @sync_to_async
    def _build_initial_sync_payload(self):
        channel = Channel.objects.filter(id=int(self.channel_id)).first()
        if channel is None:
            return {"type": "ERROR", "message": "channel_not_found"}

        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        snapshot = playback_state_store.get_playback_snapshot(channel.id) or {}
        queue_snapshot = playback_state_store.get_queue_snapshot(channel.id)
        if queue_snapshot is None:
            queue_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            queue_snapshot = self._serialize_queue_rows(queue_rows)
            playback_state_store.save_queue_snapshot(channel.id, queue_snapshot)

        track_payload = None
        if playback_session.track:
            track_payload = {
                "id": playback_session.track.id,
                "title": playback_session.track.title,
                "artist": playback_session.track.artist,
                "file": playback_session.track.file.url if playback_session.track.file else None,
            }
        if isinstance(snapshot.get("track"), dict):
            merged = dict(track_payload or {})
            merged.update(snapshot.get("track"))
            track_payload = merged

        started_at = snapshot.get("started_at_server_time", playback_session.started_at_server_time)
        position = snapshot.get("position", playback_session.paused_at_position)
        is_playing = bool(snapshot.get("is_playing", playback_session.is_playing))
        queue_version = snapshot.get("queue_version", playback_session.queue_version)
        track_file = snapshot.get("track_file")
        if track_file is None and playback_session.track and playback_session.track.file:
            track_file = playback_session.track.file.url
        # Do not consume a new sequence on handshake — reconnects should not advance seq for everyone.
        ev_seq = snapshot.get("event_seq")
        if not isinstance(ev_seq, int):
            ev_seq = 0

        payload = {
            "type": "INITIAL_SYNC",
            "action": "initial_sync",
            "event_seq": ev_seq,
            "channel_id": channel.id,
            "server_time": time.time(),
            "started_at_server_time": started_at,
            "position": position,
            "is_playing": is_playing,
            "queue_version": queue_version,
            "track_file": track_file,
            "track": track_payload,
            "queue": queue_snapshot,
            "experience": channel.experience or {},
            "brand_logo_url": channel.brand_logo.url if channel.brand_logo else None,
        }
        user = self.scope.get("user")
        if getattr(user, "is_authenticated", False) and ChannelPlaybackConsumer._user_can_manage_channel(
            channel.id, user.id
        ):
            payload["pending_count"] = ChannelPlaylistSuggestion.objects.filter(
                channel_id=channel.id,
                status=ChannelPlaylistSuggestion.Status.PENDING,
            ).count()
        return payload

    @staticmethod
    def _active_member(channel_id: int, user_id: int) -> bool:
        return ChannelMembership.objects.filter(channel_id=channel_id, user_id=user_id, is_active=True).exists()

    @staticmethod
    def _user_can_manage_channel(channel_id: int, user_id: int) -> bool:
        return ChannelMembership.objects.filter(
            channel_id=channel_id,
            user_id=user_id,
            is_active=True,
            role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
        ).exists()

    @staticmethod
    def _apply_social(at_low: str, channel_id: int, user, data: dict) -> dict | None:
        if at_low == "presence_ping":
            _touch_presence(channel_id, user.id)
            members, count = _presence_snapshot(channel_id)
            return {
                "type": "SOCIAL",
                "action": "presence_update",
                "channel_id": channel_id,
                "count": count,
                "members": members,
            }
        if at_low == "reaction":
            emoji = str(data.get("emoji") or "♪")[:8]
            return {
                "type": "SOCIAL",
                "action": "reaction",
                "channel_id": channel_id,
                "emoji": emoji,
                "username": getattr(user, "username", "?"),
                "user_id": user.id,
            }
        if at_low == "shout":
            msg = str(data.get("message") or "").strip()[:40]
            if not msg:
                return None
            if not playback_state_store.shout_cooldown_ok(channel_id, user.id, cooldown_sec=30):
                return {"type": "ERROR", "message": "shout_cooldown"}
            now = time.monotonic()
            last = _SHOUT_COOLDOWN[channel_id].get(user.id, 0)
            if now - last < 30:
                return {"type": "ERROR", "message": "shout_cooldown"}
            _SHOUT_COOLDOWN[channel_id][user.id] = now
            return {
                "type": "SOCIAL",
                "action": "shout",
                "channel_id": channel_id,
                "message": msg,
                "username": getattr(user, "username", "?"),
            }
        if at_low == "vote_skip":
            ps = PlaybackSession.objects.filter(channel_id=channel_id).select_related("track").first()
            tid = ps.track_id if ps and ps.track_id else 0
            key = (channel_id, tid)
            s = _SKIP_VOTES.setdefault(key, set())
            s.add(user.id)
            redis_votes = playback_state_store.add_skip_vote(channel_id, tid, user.id) if tid else -1
            ch = Channel.objects.filter(id=channel_id).first()
            threshold = 0
            if ch and isinstance(ch.experience, dict):
                try:
                    threshold = int(ch.experience.get("veto_skip_threshold") or 0)
                except (TypeError, ValueError):
                    threshold = 0
            votes = redis_votes if redis_votes > 0 else len(s)
            if threshold > 0 and votes >= max(1, threshold - 1):
                from apps.common.webpush_service import notify_channel_skip_threshold_near_push

                notify_channel_skip_threshold_near_push(channel_id, votes=votes, threshold=threshold, actor_user_id=user.id)
            out: dict = {
                "type": "SOCIAL",
                "action": "vote_skip",
                "channel_id": channel_id,
                "votes": votes,
                "track_id": tid,
                "threshold": threshold,
            }
            if threshold > 0 and votes >= threshold and tid:
                _SKIP_VOTES.pop(key, None)
                playback_state_store.clear_skip_votes(channel_id, tid)
                nxt = ChannelPlaybackConsumer._advance_next_sync(channel_id)
                if nxt:
                    out["_next_playback_payload"] = nxt
            return out
        return None

    @staticmethod
    def _build_payload(channel: Channel, action: str, playback_session: PlaybackSession, position: float | None, **extra):
        track_payload = None
        if playback_session.track:
            track_payload = {
                "id": playback_session.track.id,
                "title": playback_session.track.title,
                "artist": playback_session.track.artist,
                "file": playback_session.track.file.url if playback_session.track.file else None,
            }
        payload = {
            "type": action.upper(),
            "action": action,
            "event_seq": playback_state_store.next_event_seq(channel.id),
            "channel_id": channel.id,
            "server_time": time.time(),
            "started_at_server_time": playback_session.started_at_server_time,
            "position": position,
            "is_playing": playback_session.is_playing,
            "queue_version": playback_session.queue_version,
            "track_file": playback_session.track.file.url if playback_session.track and playback_session.track.file else None,
            "track": track_payload,
        }
        payload.update(playback_queue_meta(channel, playback_session))
        payload.update(extra)
        return payload

    @staticmethod
    def _advance_next_sync(channel_id: int) -> dict | None:
        """Advance to the next queue item (same rules as control `next`). Returns broadcast payload or None."""
        channel = Channel.objects.filter(id=channel_id).first()
        if channel is None:
            return None
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        queue = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
        if not queue:
            return None
        target_index = apply_queue_advance(channel, playback_session, queue, "next")
        playback_session.queue_version += 1
        playback_session.save(
            update_fields=["track", "is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"]
        )
        action = "pause" if target_index is None else "next"
        payload = ChannelPlaybackConsumer._build_payload(channel, action, playback_session, 0.0)
        playback_state_store.save_playback_snapshot(channel.id, payload)
        return payload

    def _apply_auto_next(self, user_id: int, data: dict | None = None) -> dict | None:
        """Advance queue like next(); any active member may trigger after server timeline nears track end."""
        data = data or {}
        channel_id_int = int(self.channel_id)
        channel = Channel.objects.filter(id=channel_id_int).first()
        if channel is None or not channel.is_active:
            return None
        if not ChannelMembership.objects.filter(channel=channel, user_id=user_id, is_active=True).exists():
            return None
        if not playback_state_store.try_auto_next_lock(channel.id):
            return None

        client_event_id = str((data or {}).get("client_event_id") or "").strip()
        if client_event_id and not playback_state_store.try_auto_next_idempotency(channel.id, client_event_id):
            return None

        playback_session = PlaybackSession.objects.select_related("track").filter(channel=channel).first()
        if playback_session is None or not playback_session.is_playing:
            return None

        queue = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
        if not queue:
            return None

        track = playback_session.track
        if track is None:
            return None

        started = playback_session.started_at_server_time
        if started is None:
            return None

        expected_pos = time.time() - float(started)
        dur = float(track.duration_seconds or 0)
        cdur_raw = data.get("client_duration_sec")
        cdur = 0.0
        try:
            if cdur_raw is not None and cdur_raw != "":
                cdur = float(cdur_raw)
        except (TypeError, ValueError):
            cdur = 0.0
        if not math.isfinite(cdur) or cdur < 0:
            cdur = 0.0

        candidates = []
        if dur >= 5.0:
            candidates.append(dur)
        if cdur >= 5.0:
            candidates.append(cdur)
        if candidates:
            ref = min(candidates)
            slack = max(8.0, min(45.0, ref * 0.15))
            if expected_pos < ref - slack:
                return None
        else:
            ref_small = max(dur, cdur)
            if ref_small > 0 and ref_small < 5.0:
                if expected_pos < max(0.0, ref_small - 0.35):
                    return None
            elif expected_pos < 15.0:
                return None

        target_index = apply_queue_advance(channel, playback_session, queue, "next")
        playback_session.queue_version += 1
        playback_session.save(
            update_fields=["track", "is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"]
        )
        action_name = "pause" if target_index is None else "next"
        payload = ChannelPlaybackConsumer._build_payload(channel=channel, action=action_name, playback_session=playback_session, position=0.0)
        playback_state_store.save_playback_snapshot(channel.id, payload)
        return payload

    @sync_to_async
    def _apply_action(self, action: str, data: dict, user_id: int | None):
        channel = Channel.objects.filter(id=int(self.channel_id)).first()
        if channel is None:
            return {"type": "ERROR", "message": "channel_not_found"}
        blocked, scheduled_at = scheduled_start_blocks_playback(channel)
        if blocked and action in {"play", "play_playlist", "shuffle_play"}:
            return {"type": "ERROR", "message": "scheduled_not_started", "scheduled_start_at": scheduled_at}
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        def record_event(ev: str, payload: dict | None = None):
            from apps.playback.models import PlaybackEvent

            PlaybackEvent.objects.create(
                channel=channel,
                actor_id=user_id,
                track=playback_session.track,
                event_type=ev,
                source="ws",
                payload=payload or {},
            )
        position = data.get("position")
        if position is not None:
            position = float(position)

        if action == "play_playlist":
            playlist_id = data.get("playlist_id")
            start_index = data.get("start_index")
            if not playlist_id:
                return {"type": "ERROR", "message": "playlist_required"}
            playlist = Playlist.objects.filter(id=int(playlist_id)).first()
            if playlist is None:
                return {"type": "ERROR", "message": "playlist_not_found"}
            if playlist.owner_id != user_id and playlist.channel_id != channel.id:
                return {"type": "ERROR", "message": "playlist_not_allowed"}
            items = list(playlist.items.select_related("track").all())
            if not items:
                return {"type": "ERROR", "message": "playlist_empty"}
            if start_index is None:
                start_index = 0
            start_index = max(0, min(int(start_index), len(items) - 1))
            ChannelQueueItem.objects.filter(channel=channel).delete()
            queue_rows = [
                ChannelQueueItem(channel=channel, track=item.track, position=index, added_by_id=user_id)
                for index, item in enumerate(items)
            ]
            ChannelQueueItem.objects.bulk_create(queue_rows)
            persisted_queue_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            set_active_playlist(channel, playlist.id, playlist.name)
            set_playback_source(channel, "playlist")
            playback_session.track = items[start_index].track
            playback_session.is_playing = True
            playback_session.started_at_server_time = time.time()
            playback_session.paused_at_position = 0
            playback_session.queue_version += 1
            playback_session.save(
                update_fields=["track", "is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"]
            )
            payload = ChannelPlaybackConsumer._build_payload(
                channel=channel,
                action="play",
                playback_session=playback_session,
                position=0.0,
                playlist_id=playlist.id,
                start_index=start_index,
            )
            playback_state_store.save_playback_snapshot(channel.id, payload)
            playback_state_store.save_queue_snapshot(channel.id, self._serialize_queue_rows(persisted_queue_rows))
            return payload

        if action == "shuffle_play":
            if not user_id:
                return {"type": "ERROR", "message": "permission_denied"}
            user = User.objects.filter(id=user_id).first()
            if user is None:
                return {"type": "ERROR", "message": "permission_denied"}
            limit = data.get("limit")
            if limit in (None, ""):
                limit_n = None
            else:
                try:
                    limit_n = int(limit)
                except (TypeError, ValueError):
                    limit_n = None
                if limit_n is not None and limit_n <= 0:
                    limit_n = None
                elif limit_n is not None:
                    limit_n = min(limit_n, MAX_SHUFFLE_TRACKS)
            ex = channel.experience if isinstance(channel.experience, dict) else {}
            try:
                anti_repeat_window = max(0, int(ex.get("anti_repeat_window") or 0))
            except (TypeError, ValueError):
                anti_repeat_window = 0
            try:
                weighted_bias = max(0.0, min(2.0, float(ex.get("weighted_shuffle_bias") or 0.0)))
            except (TypeError, ValueError):
                weighted_bias = 0.0
            tracks = pick_shuffled_tracks(
                user,
                channel,
                limit_n,
                anti_repeat_window=anti_repeat_window,
                weighted_bias=weighted_bias,
            )
            if not tracks:
                return {"type": "ERROR", "message": "no_tracks"}
            clear_active_playlist(channel)
            set_playback_source(channel, "shuffle")
            persisted_rows = replace_queue_with_tracks(channel=channel, tracks=tracks, user_id=user_id)
            apply_track_to_session(playback_session, tracks[0])
            playback_session.save(
                update_fields=[
                    "track",
                    "is_playing",
                    "started_at_server_time",
                    "paused_at_position",
                    "queue_version",
                    "updated_at",
                ]
            )
            payload = ChannelPlaybackConsumer._build_payload(
                channel=channel,
                action="play",
                playback_session=playback_session,
                position=0.0,
                shuffle=True,
            )
            playback_state_store.save_playback_snapshot(channel.id, payload)
            playback_state_store.save_queue_snapshot(channel.id, self._serialize_queue_rows(persisted_rows))
            record_event("shuffle_play", {"limit": limit_n})
            return payload

        if action == "blind_draw":
            if not user_id:
                return {"type": "ERROR", "message": "permission_denied"}
            ex = channel.experience or {}
            pid = data.get("playlist_id") or ex.get("blind_playlist_id")
            if not pid:
                return {"type": "ERROR", "message": "playlist_required"}
            try:
                pid_int = int(pid)
            except (TypeError, ValueError):
                return {"type": "ERROR", "message": "playlist_required"}
            playlist = Playlist.objects.filter(id=pid_int).first()
            if playlist is None or playlist.channel_id != channel.id:
                return {"type": "ERROR", "message": "playlist_not_found"}
            items = list(PlaylistItem.objects.filter(playlist=playlist).select_related("track"))
            if not items:
                return {"type": "ERROR", "message": "playlist_empty"}
            pick = random.choice(items)
            track = pick.track
            if track is None:
                return {"type": "ERROR", "message": "track_not_found"}
            queue_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            next_position = queue_rows[-1].position + 1 if queue_rows else 0
            new_row = ChannelQueueItem.objects.create(
                channel=channel,
                track=track,
                position=next_position,
                added_by_id=user_id,
            )
            queue_snapshot_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            playback_session.queue_version += 1
            playback_session.save(update_fields=["queue_version", "updated_at"])
            payload = ChannelPlaybackConsumer._build_payload(
                channel=channel,
                action="add_to_queue",
                playback_session=playback_session,
                position=playback_session.paused_at_position,
                added_track_id=new_row.track_id,
                added_position=new_row.position,
                blind_pick=True,
            )
            playback_state_store.save_playback_snapshot(channel.id, payload)
            playback_state_store.save_queue_snapshot(channel.id, self._serialize_queue_rows(queue_snapshot_rows))
            record_event("add_to_queue", {"blind_pick": True, "track_id": new_row.track_id})
            return payload

        if action in {"add_to_queue", "enqueue_next"}:
            track_id = data.get("track_id")
            if not track_id:
                return {"type": "ERROR", "message": "track_required"}
            track = Track.objects.filter(id=int(track_id)).first()
            if track is None:
                return {"type": "ERROR", "message": "track_not_found"}
            ex = channel.experience if isinstance(channel.experience, dict) else {}
            if ex.get("queue_locked") and channel.owner_id != user_id:
                return {"type": "ERROR", "message": "queue_locked"}
            if ex.get("listening_party_only"):
                row = ChannelMembership.objects.filter(channel_id=channel.id, user_id=user_id, is_active=True).only("role").first()
                if row and row.role not in (ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR):
                    return {"type": "ERROR", "message": "listening_party_only"}
            queue_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            if action == "enqueue_next":
                insert_at = 0
                if playback_session.track_id is not None:
                    for row in queue_rows:
                        if row.track_id == playback_session.track_id:
                            insert_at = row.position + 1
                            break
                for row in queue_rows:
                    if row.position >= insert_at:
                        row.position += 1
                ChannelQueueItem.objects.bulk_update(queue_rows, ["position"])
                new_row = ChannelQueueItem.objects.create(
                    channel=channel,
                    track=track,
                    position=insert_at,
                    added_by_id=user_id,
                )
            else:
                next_position = queue_rows[-1].position + 1 if queue_rows else 0
                new_row = ChannelQueueItem.objects.create(
                    channel=channel,
                    track=track,
                    position=next_position,
                    added_by_id=user_id,
                )
                from apps.playback.services.channel_queue import rebalance_queue_premium_boost

                rebalance_queue_premium_boost(channel=channel, current_track_id=playback_session.track_id)
            queue_snapshot_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            playback_session.queue_version += 1
            playback_session.save(update_fields=["queue_version", "updated_at"])
            payload = ChannelPlaybackConsumer._build_payload(
                channel=channel,
                action=action,
                playback_session=playback_session,
                position=playback_session.paused_at_position,
                added_track_id=new_row.track_id,
                added_position=new_row.position,
            )
            playback_state_store.save_playback_snapshot(channel.id, payload)
            playback_state_store.save_queue_snapshot(channel.id, self._serialize_queue_rows(queue_snapshot_rows))
            record_event(action, {"track_id": new_row.track_id})
            return payload

        if action == "play":
            if playback_session.track_id is None:
                first_queue_item = ChannelQueueItem.objects.filter(channel=channel).order_by("position").first()
                if first_queue_item:
                    playback_session.track = first_queue_item.track
            if playback_session.track_id is None:
                return {"type": "ERROR", "message": "queue_empty"}
            resume_from = float(position) if position is not None else float(playback_session.paused_at_position or 0)
            playback_session.is_playing = True
            playback_session.started_at_server_time = time.time() - max(0.0, resume_from)
            playback_session.paused_at_position = max(0.0, resume_from)
        elif action == "pause":
            playback_session.is_playing = False
            playback_session.paused_at_position = float(position) if position is not None else float(playback_session.paused_at_position or 0)
        elif action == "seek":
            seek_position = float(position) if position is not None else float(playback_session.paused_at_position or 0)
            playback_session.paused_at_position = max(0.0, seek_position)
            if playback_session.is_playing:
                playback_session.started_at_server_time = time.time() - playback_session.paused_at_position
        elif action in {"next", "prev"}:
            queue = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
            if queue:
                direction = "next" if action == "next" else "prev"
                target_index = apply_queue_advance(channel, playback_session, queue, direction)
                if target_index is None:
                    action = "pause"
            playback_session.queue_version += 1

        playback_session.save(update_fields=["is_playing", "started_at_server_time", "paused_at_position", "queue_version", "track", "updated_at"])
        payload = ChannelPlaybackConsumer._build_payload(channel=channel, action=action, playback_session=playback_session, position=position)
        playback_state_store.save_playback_snapshot(channel.id, payload)
        record_event(action, {"position": position})
        return payload
