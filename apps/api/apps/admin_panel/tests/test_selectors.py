"""Date range and billing selector tests."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import PremiumCodeRedemption, PremiumInviteCode, PremiumStripePurchase
from apps.admin_panel.selectors.date_range import date_range_bounds, filter_created_at, parse_date_param
from apps.admin_panel.selectors.platform_billing import build_billing_overview
from apps.social.models import ReferralCode, ReferralSignup
from apps.social.services.referral import apply_referral_on_signup


class DateRangeSelectorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("dater", password="pass12345")
        self.referred = User.objects.create_user("referred", password="pass12345")
        ReferralCode.objects.create(user=self.user, code="DATECODE")
        apply_referral_on_signup(user_id=self.referred.id, raw_code="DATECODE")

    def test_parse_date_param(self):
        self.assertIsNone(parse_date_param(""))
        self.assertIsNone(parse_date_param("bad"))
        self.assertEqual(parse_date_param("2026-01-15").isoformat(), "2026-01-15")

    def test_date_range_bounds(self):
        start, end = date_range_bounds("2026-01-01", "2026-01-02")
        self.assertIsNotNone(start)
        self.assertIsNotNone(end)
        self.assertLess(start, end)

    def test_billing_overview_uses_redeemed_at_field(self):
        code = PremiumInviteCode.objects.create(max_uses=5)
        PremiumCodeRedemption.objects.create(code=code, user=self.user)
        overview = build_billing_overview(date_from="2099-01-01")
        self.assertEqual(overview["code_redemptions"], 0)

        today = timezone.localdate().isoformat()
        overview_today = build_billing_overview(date_from=today, date_to=today)
        self.assertGreaterEqual(overview_today["code_redemptions"], 1)

    def test_filter_created_at_on_stripe_purchases(self):
        PremiumStripePurchase.objects.create(user=self.user, stripe_session_id="cs_date_test")
        filtered = filter_created_at(PremiumStripePurchase.objects.all(), date_from="2099-01-01")
        self.assertEqual(filtered.count(), 0)

    def test_referral_signup_date_filter(self):
        future = build_billing_overview(date_from="2099-01-01")
        self.assertEqual(future["referral_signups"], 0)
        self.assertGreaterEqual(ReferralSignup.objects.count(), 1)
