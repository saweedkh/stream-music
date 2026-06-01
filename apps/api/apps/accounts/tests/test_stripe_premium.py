from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from apps.accounts.models import SLUG_PREMIUM
from apps.accounts.services.stripe_premium import (
    StripePremiumError,
    create_premium_checkout_session,
    grant_premium_from_stripe,
    stripe_configured,
)
from apps.accounts.user_badges import badges_for_user


class StripePremiumTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="stripe_user", password="x")

    @override_settings(STRIPE_SECRET_KEY="", STRIPE_PRICE_ID="")
    def test_not_configured(self):
        self.assertFalse(stripe_configured())
        with self.assertRaises(StripePremiumError):
            create_premium_checkout_session(
                self.user.id,
                username="stripe_user",
                success_url="http://x/s",
                cancel_url="http://x/c",
            )

    def test_grant_premium(self):
        grant_premium_from_stripe(self.user.id, session_id="cs_test")
        slugs = {b["slug"] for b in badges_for_user(self.user)}
        self.assertIn(SLUG_PREMIUM, slugs)
