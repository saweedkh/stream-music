from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("stream_channels", "0010_usernotificationsettings_quiet_hours"),
        ("tracks", "0003_track_file_hash"),
    ]

    operations = [
        migrations.AddField(
            model_name="channelchatmessage",
            name="reply_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="replies",
                to="stream_channels.channelchatmessage",
            ),
        ),
        migrations.AlterField(
            model_name="channelplaylistsuggestion",
            name="track",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="channel_playlist_suggestions",
                to="tracks.track",
            ),
        ),
        migrations.AddField(
            model_name="channelplaylistsuggestion",
            name="external_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="channelplaylistsuggestion",
            name="external_title",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="channelplaylistsuggestion",
            name="external_artist",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="channelplaylistsuggestion",
            name="external_source",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
