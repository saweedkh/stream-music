import json
import math
import time

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import User

from apps.channels.models import Channel, ChannelMembership
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.services.channel_queue import apply_track_to_session, pick_shuffled_tracks, replace_queue_with_tracks
from apps.playback.services.state_store import playback_state_store
from apps.playlists.models import ChannelQueueItem, Playlist
from apps.tracks.models import Track


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
        initial_payload = await self._build_initial_sync_payload()
        await self.send(text_data=json.dumps(initial_payload))

    async def disconnect(self, close_code):
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
        action = self._normalize_action(action_text)
        user = self.scope.get("user")
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
            await self.channel_layer.group_send(self.group_name, {"type": "broadcast_event", "payload": payload})
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
        await self.channel_layer.group_send(self.group_name, {"type": "broadcast_event", "payload": payload})

    async def broadcast_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

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

        return {
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
        }

    def _build_payload(self, channel: Channel, action: str, playback_session: PlaybackSession, position: float | None, **extra):
        track_payload = None
        if playback_session.track:
            track_payload = {
                "id": playback_session.track.id,
                "title": playback_session.track.title,
                "artist": playback_session.track.artist,
                "file": playback_session.track.file.url if playback_session.track.file else None,
            }
        return {
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
            **extra,
        }

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

        current_index = 0
        if playback_session.track_id is not None:
            for idx, row in enumerate(queue):
                if row.track_id == playback_session.track_id:
                    current_index = idx
                    break
        target_index = (current_index + 1) % len(queue)
        playback_session.track = queue[target_index].track
        playback_session.is_playing = True
        playback_session.started_at_server_time = time.time()
        playback_session.paused_at_position = 0
        playback_session.queue_version += 1
        playback_session.save(
            update_fields=["track", "is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"]
        )

        payload = self._build_payload(channel=channel, action="next", playback_session=playback_session, position=0.0)
        playback_state_store.save_playback_snapshot(channel.id, payload)
        return payload

    @sync_to_async
    def _apply_action(self, action: str, data: dict, user_id: int | None):
        channel = Channel.objects.filter(id=int(self.channel_id)).first()
        if channel is None:
            return {"type": "ERROR", "message": "channel_not_found"}
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
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
            playback_session.track = items[start_index].track
            playback_session.is_playing = True
            playback_session.started_at_server_time = time.time()
            playback_session.paused_at_position = 0
            playback_session.queue_version += 1
            playback_session.save(
                update_fields=["track", "is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"]
            )
            payload = self._build_payload(
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
            try:
                limit_n = int(limit) if limit is not None else 50
            except (TypeError, ValueError):
                limit_n = 50
            limit_n = max(1, min(limit_n, 200))
            tracks = pick_shuffled_tracks(user, channel, limit_n)
            if not tracks:
                return {"type": "ERROR", "message": "no_tracks"}
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
            payload = self._build_payload(
                channel=channel,
                action="play",
                playback_session=playback_session,
                position=0.0,
                shuffle=True,
            )
            playback_state_store.save_playback_snapshot(channel.id, payload)
            playback_state_store.save_queue_snapshot(channel.id, self._serialize_queue_rows(persisted_rows))
            return payload

        if action in {"add_to_queue", "enqueue_next"}:
            track_id = data.get("track_id")
            if not track_id:
                return {"type": "ERROR", "message": "track_required"}
            track = Track.objects.filter(id=int(track_id)).first()
            if track is None:
                return {"type": "ERROR", "message": "track_not_found"}
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
            queue_snapshot_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
            playback_session.queue_version += 1
            playback_session.save(update_fields=["queue_version", "updated_at"])
            payload = self._build_payload(
                channel=channel,
                action=action,
                playback_session=playback_session,
                position=playback_session.paused_at_position,
                added_track_id=new_row.track_id,
                added_position=new_row.position,
            )
            playback_state_store.save_playback_snapshot(channel.id, payload)
            playback_state_store.save_queue_snapshot(channel.id, self._serialize_queue_rows(queue_snapshot_rows))
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
                current_index = 0
                if playback_session.track_id is not None:
                    for idx, row in enumerate(queue):
                        if row.track_id == playback_session.track_id:
                            current_index = idx
                            break
                target_index = (current_index + 1) % len(queue) if action == "next" else (current_index - 1) % len(queue)
                playback_session.track = queue[target_index].track
                playback_session.is_playing = True
                playback_session.started_at_server_time = time.time()
                playback_session.paused_at_position = 0
            playback_session.queue_version += 1

        playback_session.save(update_fields=["is_playing", "started_at_server_time", "paused_at_position", "queue_version", "track", "updated_at"])
        payload = self._build_payload(channel=channel, action=action, playback_session=playback_session, position=position)
        playback_state_store.save_playback_snapshot(channel.id, payload)
        return payload
