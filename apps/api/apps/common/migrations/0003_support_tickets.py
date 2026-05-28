# Support ticketing

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0002_account_badges"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SupportTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(db_index=True, max_length=32, unique=True)),
                ("subject", models.CharField(max_length=200)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("general", "General"),
                            ("account", "Account"),
                            ("billing", "Billing"),
                            ("technical", "Technical"),
                            ("feature", "Feature request"),
                            ("other", "Other"),
                        ],
                        default="general",
                        max_length=32,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("in_progress", "In progress"),
                            ("waiting_user", "Waiting for user"),
                            ("waiting_staff", "Waiting for staff"),
                            ("resolved", "Resolved"),
                            ("closed", "Closed"),
                        ],
                        db_index=True,
                        default="open",
                        max_length=32,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[("low", "Low"), ("normal", "Normal"), ("high", "High"), ("urgent", "Urgent")],
                        db_index=True,
                        default="normal",
                        max_length=16,
                    ),
                ),
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
            options={"ordering": ["-last_message_at", "-updated_at", "-id"]},
        ),
        migrations.CreateModel(
            name="SupportMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("is_internal", models.BooleanField(default=False, help_text="Visible to support staff only.")),
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
                        to="common.supportticket",
                    ),
                ),
            ],
            options={"ordering": ["created_at", "id"]},
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
                        to="common.supportticket",
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
        migrations.AlterUniqueTogether(
            name="supportticketread",
            unique_together={("ticket", "user")},
        ),
    ]
