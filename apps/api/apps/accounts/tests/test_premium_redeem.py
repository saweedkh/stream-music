"""Premium invite code redemption tests."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import SLUG_PREMIUM, PremiumInviteCode, UserBadgeDefinition
from apps.accounts.services.premium_redeem import PremiumRedeemError, redeem_premium_code
from apps.accounts.user_badges import badges_for_user


class PremiumRedeemTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("u1", password="pass12345")
        UserBadgeDefinition.objects.get_or_create(
            slug=SLUG_PREMIUM,
            defaults={"label": "Premium", "priority": 50, "is_system": True},
        )

    def test_redeem_valid_code(self):
        code = PremiumInviteCode.objects.create(max_uses=2, expires_at=timezone.now() + timedelta(days=1))
        result = redeem_premium_code(self.user.id, code.code)
        self.assertTrue(result["ok"])
        slugs = {b["slug"] for b in badges_for_user(self.user)}
        self.assertIn(SLUG_PREMIUM, slugs)

    def test_redeem_twice_fails(self):
        code = PremiumInviteCode.objects.create(max_uses=5)
        redeem_premium_code(self.user.id, code.code)
        with self.assertRaises(PremiumRedeemError):
            redeem_premium_code(self.user.id, code.code)
