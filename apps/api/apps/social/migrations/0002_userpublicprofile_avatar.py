from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stream_social", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpublicprofile",
            name="avatar",
            field=models.FileField(blank=True, null=True, upload_to="avatars/%Y/%m/"),
        ),
    ]
