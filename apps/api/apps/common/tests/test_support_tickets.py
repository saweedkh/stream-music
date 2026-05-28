from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.common.support_models import SupportTicket


class SupportTicketApiTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username="member", password="pw123456")
        self.staff = User.objects.create_user(username="agent", password="pw123456", is_staff=True)

    def _csrf(self):
        self.client.get("/api/auth/csrf")
        return self.client.cookies["csrftoken"].value

    def _login(self, username: str, password: str = "pw123456"):
        csrf = self._csrf()
        self.client.post(
            "/api/auth/login",
            {"username": username, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    def test_create_and_list_ticket(self):
        self._login("member")
        csrf = self._csrf()
        created = self.client.post(
            "/api/support/tickets",
            {"subject": "Cannot play track", "category": "technical", "body": "Playback stops after 10s"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(created.status_code, 201)
        payload = created.json()
        self.assertTrue(payload["ticket"]["reference"].startswith("TK-"))
        self.assertEqual(payload["ticket"]["status"], "waiting_staff")

        listed = self.client.get("/api/support/tickets")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["total"], 1)

    def test_staff_sees_all_tickets_user_sees_own_only(self):
        self._login("member")
        csrf = self._csrf()
        self.client.post(
            "/api/support/tickets",
            {"subject": "Help", "category": "general", "body": "Need assistance"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

        self._login("agent")
        staff_list = self.client.get("/api/support/tickets")
        self.assertEqual(staff_list.status_code, 200)
        self.assertEqual(staff_list.json()["total"], 1)
        self.assertIn("stats", staff_list.json())

        other = User.objects.create_user(username="other", password="pw123456")
        self._login("other")
        other_list = self.client.get("/api/support/tickets")
        self.assertEqual(other_list.json()["total"], 0)

    def test_staff_reply_updates_status(self):
        self._login("member")
        csrf = self._csrf()
        created = self.client.post(
            "/api/support/tickets",
            {"subject": "Billing", "category": "billing", "body": "Question about plan"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        ticket_id = created.json()["ticket"]["id"]

        self._login("agent")
        csrf = self._csrf()
        reply = self.client.post(
            f"/api/support/tickets/{ticket_id}/messages",
            {"body": "We will check your account."},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.json()["ticket"]["status"], "waiting_user")

        ticket = SupportTicket.objects.get(id=ticket_id)
        self.assertEqual(ticket.status, SupportTicket.Status.WAITING_USER)
