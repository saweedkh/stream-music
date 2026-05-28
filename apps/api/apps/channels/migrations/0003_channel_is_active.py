from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stream_channels", "0002_channel_join_requires_approval_channeljoinrequest"),
    ]

    operations = [
        migrations.AddField(
            model_name="channel",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]
