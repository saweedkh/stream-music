# State-only: remove models from common app; tables unchanged in DB

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0005_user_follow"),
        ("playlists", "0004_playlistsharelink_state"),
        ("stream_social", "0001_initial"),
        ("stream_support", "0001_initial"),
        ("stream_accounts", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="ChannelFollow"),
                migrations.DeleteModel(name="PlaylistShareLink"),
                migrations.DeleteModel(name="SupportMessage"),
                migrations.DeleteModel(name="SupportTicket"),
                migrations.DeleteModel(name="SupportTicketRead"),
                migrations.DeleteModel(name="UserFollow"),
                migrations.DeleteModel(name="UserPlaylistFavorite"),
                migrations.DeleteModel(name="UserPublicProfile"),
                migrations.DeleteModel(name="UserTrackFavorite"),
            ],
        ),
    ]
