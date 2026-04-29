from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class AuthViewsTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def _prime_csrf(self):
        self.client.get("/api/auth/csrf")
        return self.client.cookies["csrftoken"].value

    def test_register_login_me_logout_flow(self):
        csrf = self._prime_csrf()
        register = self.client.post(
            "/api/auth/register",
            {"username": "alice", "email": "alice@example.com", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(register.status_code, 201)
        self.assertTrue(User.objects.filter(username="alice").exists())

        me = self.client.get("/api/auth/me")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["user"]["username"], "alice")

        csrf = self.client.cookies["csrftoken"].value
        logout = self.client.post("/api/auth/logout", {}, format="json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(logout.status_code, 200)

        me_after = self.client.get("/api/auth/me")
        self.assertEqual(me_after.status_code, 403)

    def test_login_invalid_credentials(self):
        User.objects.create_user(username="bob", password="pw123456")
        csrf = self._prime_csrf()
        response = self.client.post(
            "/api/auth/login",
            {"username": "bob", "password": "bad"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 401)
