from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("stream_channels", "0011_chat_reply_suggestion_external"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ChannelChatReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(blank=True, default="", max_length=500)),
                ("status", models.CharField(choices=[("open", "Open"), ("dismissed", "Dismissed")], default="open", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "channel",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chat_reports", to="stream_channels.channel"),
                ),
                (
                    "message",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reports", to="stream_channels.channelchatmessage"),
                ),
                (
                    "reporter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="channel_chat_reports_filed",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"indexes": [models.Index(fields=["channel", "status", "-created_at"], name="stream_chan_channel_8a1f2d_idx")]},
        ),
        migrations.CreateModel(
            name="ChannelChatBan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(blank=True, default="", max_length=280)),
                ("banned_until", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "banned_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="channel_chat_bans_issued",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "channel",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chat_bans", to="stream_channels.channel"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="channel_chat_bans",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [models.Index(fields=["channel", "banned_until"], name="stream_chan_channel_ban_idx")],
                "unique_together": {("channel", "user")},
            },
        ),
    ]
