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
        data = me.json()
        self.assertEqual(data["user"]["username"], "alice")
        self.assertIn("notification_settings", data)
        self.assertEqual(data["notification_settings"]["chat_notify"], "all")

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

    def test_patch_me_profile(self):
        User.objects.create_user(username="carol", email="old@example.com", password="pw123456")
        csrf = self._prime_csrf()
        self.client.post(
            "/api/auth/login",
            {"username": "carol", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        csrf = self.client.cookies["csrftoken"].value
        res = self.client.patch(
            "/api/auth/me",
            {"email": "new@example.com", "first_name": "Carol", "last_name": "D"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user"]["email"], "new@example.com")
        self.assertEqual(data["user"]["first_name"], "Carol")
        self.assertEqual(data["user"]["last_name"], "D")

    def test_patch_me_username_when_available(self):
        User.objects.create_user(username="carol2", email="c@example.com", password="pw123456")
        csrf = self._prime_csrf()
        self.client.post(
            "/api/auth/login",
            {"username": "carol2", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        csrf = self.client.cookies["csrftoken"].value
        res = self.client.patch(
            "/api/auth/me",
            {"username": "carol_renamed"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["user"]["username"], "carol_renamed")

    def test_username_available_endpoint(self):
        User.objects.create_user(username="taken_name", password="pw123456")
        User.objects.create_user(username="owner", password="pw123456")
        csrf = self._prime_csrf()
        self.client.post(
            "/api/auth/login",
            {"username": "owner", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        csrf = self.client.cookies["csrftoken"].value
        free = self.client.get("/api/auth/username-available?username=new_handle", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(free.status_code, 200)
        self.assertTrue(free.json()["available"])
        taken = self.client.get("/api/auth/username-available?username=taken_name", HTTP_X_CSRFTOKEN=csrf)
        self.assertFalse(taken.json()["available"])

    def test_change_password_wrong_current(self):
        User.objects.create_user(username="dave", password="pw123456")
        csrf = self._prime_csrf()
        self.client.post(
            "/api/auth/login",
            {"username": "dave", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        csrf = self.client.cookies["csrftoken"].value
        res = self.client.post(
            "/api/auth/me/password",
            {"current_password": "wrong", "new_password": "newpass12"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(res.status_code, 400)

    def test_change_password_success(self):
        User.objects.create_user(username="erin", password="pw123456")
        csrf = self._prime_csrf()
        self.client.post(
            "/api/auth/login",
            {"username": "erin", "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        csrf = self.client.cookies["csrftoken"].value
        res = self.client.post(
            "/api/auth/me/password",
            {"current_password": "pw123456", "new_password": "newpass12"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(res.status_code, 200)
        u = User.objects.get(username="erin")
        self.assertTrue(u.check_password("newpass12"))
