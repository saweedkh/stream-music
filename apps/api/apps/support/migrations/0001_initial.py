# State-only: tables remain common_* in the database

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("common", "0005_user_follow"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="SupportTicket",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("reference", models.CharField(db_index=True, max_length=32, unique=True)),
                        ("subject", models.CharField(max_length=200)),
                        ("category", models.CharField(default="general", max_length=32)),
                        ("status", models.CharField(db_index=True, default="open", max_length=32)),
                        ("priority", models.CharField(db_index=True, default="normal", max_length=16)),
                        ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        ("closed_at", models.DateTimeField(blank=True, null=True)),
                        ("last_message_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                        ("last_message_preview", models.CharField(blank=True, default="", max_length=280)),
                        (
                            "assigned_to",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="support_assigned_tickets",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                        (
                            "requester",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="support_tickets",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_supportticket",
                        "ordering": ["-last_message_at", "-updated_at", "-id"],
                    },
                ),
                migrations.CreateModel(
                    name="SupportMessage",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("body", models.TextField()),
                        ("is_internal", models.BooleanField(default=False)),
                        ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                        ("edited_at", models.DateTimeField(blank=True, null=True)),
                        (
                            "author",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="support_messages",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                        (
                            "ticket",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="messages",
                                to="stream_support.supportticket",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_supportmessage",
                        "ordering": ["created_at", "id"],
                    },
                ),
                migrations.CreateModel(
                    name="SupportTicketRead",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("last_read_message_id", models.PositiveIntegerField(default=0)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        (
                            "ticket",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="read_states",
                                to="stream_support.supportticket",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="support_reads",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_supportticketread",
                        "unique_together": {("ticket", "user")},
                    },
                ),
                migrations.AddIndex(
                    model_name="supportticket",
                    index=models.Index(fields=["requester", "-last_message_at"], name="common_supp_request_idx"),
                ),
                migrations.AddIndex(
                    model_name="supportticket",
                    index=models.Index(fields=["status", "-last_message_at"], name="common_supp_status_idx"),
                ),
                migrations.AddIndex(
                    model_name="supportticket",
                    index=models.Index(fields=["assigned_to", "-last_message_at"], name="common_supp_assign_idx"),
                ),
                migrations.AddIndex(
                    model_name="supportmessage",
                    index=models.Index(fields=["ticket", "created_at"], name="common_supp_msg_ticket_idx"),
                ),
            ],
        ),
    ]
