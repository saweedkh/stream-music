"""Add composite indexes for common query patterns across apps."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("stream_channels", "0012_chat_moderation"),
        ("playlists", "0003_channelqueueupvote"),
        ("playback", "0003_playbackevent_actor_playbackevent_source_and_more"),
        ("tracks", "0003_track_file_hash"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_owner_active ON stream_channels_channel (owner_id, is_active);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_privacy_active ON stream_channels_channel (privacy, is_active);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_membership_user_active ON stream_channels_channelmembership (user_id, is_active);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chatmsg_channel_created ON stream_channels_channelchatmessage (channel_id, created_at);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playbackevent_channel_emitted ON playback_playbackevent (channel_id, emitted_at);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_track_owner_created ON tracks_track (owner_id, created_at);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playlist_owner_channel ON playlists_playlist (owner_id, channel_id);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playlistitem_playlist_pos ON playlists_playlistitem (playlist_id, position);",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queueitem_channel_pos ON playlists_channelqueueitem (channel_id, position);",
            ],
            reverse_sql=[
                "DROP INDEX IF EXISTS idx_channel_owner_active;",
                "DROP INDEX IF EXISTS idx_channel_privacy_active;",
                "DROP INDEX IF EXISTS idx_membership_user_active;",
                "DROP INDEX IF EXISTS idx_chatmsg_channel_created;",
                "DROP INDEX IF EXISTS idx_playbackevent_channel_emitted;",
                "DROP INDEX IF EXISTS idx_track_owner_created;",
                "DROP INDEX IF EXISTS idx_playlist_owner_channel;",
                "DROP INDEX IF EXISTS idx_playlistitem_playlist_pos;",
                "DROP INDEX IF EXISTS idx_queueitem_channel_pos;",
            ],
        ),
    ]

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    atomic = False
