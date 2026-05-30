from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stream_channels", "0009_channelauditlog_channelnotificationpreference_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="usernotificationsettings",
            name="push_quiet_hours_start",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="usernotificationsettings",
            name="push_quiet_hours_end",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="usernotificationsettings",
            name="push_category_playback",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="usernotificationsettings",
            name="push_category_chat",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="usernotificationsettings",
            name="push_category_moderation",
            field=models.BooleanField(default=True),
        ),
    ]
