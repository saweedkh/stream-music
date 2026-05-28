from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracks", "0002_track_genre_track_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="track",
            name="file_hash",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
    ]
