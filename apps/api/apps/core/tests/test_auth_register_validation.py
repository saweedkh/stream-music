"""Additional auth API edge cases."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class AuthRegisterValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        User.objects.create_user(username="taken", password="pw123456")

    def _csrf(self):
        self.client.get("/api/auth/csrf")
        return self.client.cookies["csrftoken"].value

    def test_register_duplicate_username(self):
        csrf = self._csrf()
        res = self.client.post(
            "/api/auth/register",
            {"username": "taken", "email": "x@example.com", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(res.status_code, 400)

    def test_health_anonymous(self):
        res = self.client.get("/api/health")
        self.assertIn(res.status_code, [200, 503])
        body = res.json()
        self.assertIn(body.get("status"), ["ok", "degraded"])
        self.assertIn("db", body)
