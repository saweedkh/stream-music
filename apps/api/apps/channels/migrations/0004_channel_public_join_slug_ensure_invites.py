from django.db import migrations, models


def ensure_active_invite_per_channel(apps, schema_editor):
    Channel = apps.get_model("stream_channels", "Channel")
    InviteToken = apps.get_model("stream_channels", "InviteToken")
    for ch in Channel.objects.all().iterator():
        if InviteToken.objects.filter(channel_id=ch.id, is_active=True).exists():
            continue
        InviteToken.objects.create(
            channel_id=ch.id,
            created_by_id=ch.owner_id,
            is_active=True,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("stream_channels", "0003_channel_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="channel",
            name="public_join_slug",
            field=models.CharField(blank=True, db_index=True, max_length=40, null=True, unique=True),
        ),
        migrations.RunPython(ensure_active_invite_per_channel, migrations.RunPython.noop),
    ]
