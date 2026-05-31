"""Support message attachments."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stream_support", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="supportmessage",
            name="attachment",
            field=models.FileField(blank=True, null=True, upload_to="support/%Y/%m/"),
        ),
        migrations.AddField(
            model_name="supportmessage",
            name="attachment_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="supportmessage",
            name="attachment_size",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="supportmessage",
            name="attachment_content_type",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
    ]
