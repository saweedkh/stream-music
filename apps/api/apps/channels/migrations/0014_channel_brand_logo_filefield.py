from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("stream_channels", "0013_add_performance_indexes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="channel",
            name="brand_logo",
            field=models.FileField(blank=True, null=True, upload_to="channel_brand/"),
        ),
    ]
