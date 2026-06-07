from django.contrib.auth.models import User
from django.test import TestCase

from apps.social.models import ReferralCode, ReferralSignup
from apps.social.services.referral import ReferralApplyError, apply_referral_on_signup


class ReferralSignupTests(TestCase):
    def setUp(self):
        self.referrer = User.objects.create_user(username="referrer", password="pass")
        self.new_user = User.objects.create_user(username="newbie", password="pass")
        self.code = ReferralCode.objects.create(user=self.referrer, code="FRIEND10")

    def test_applies_valid_code(self):
        result = apply_referral_on_signup(user_id=self.new_user.id, raw_code="friend10")
        self.code.refresh_from_db()

        self.assertEqual(result["referrer_id"], self.referrer.id)
        self.assertEqual(result["signup_count"], 1)
        self.assertTrue(ReferralSignup.objects.filter(referred_user=self.new_user).exists())
        self.assertEqual(self.code.signup_count, 1)

    def test_rejects_invalid_code(self):
        with self.assertRaises(ReferralApplyError) as ctx:
            apply_referral_on_signup(user_id=self.new_user.id, raw_code="NOPE")
        self.assertEqual(ctx.exception.code, "invalid_referral_code")

    def test_rejects_self_referral(self):
        with self.assertRaises(ReferralApplyError) as ctx:
            apply_referral_on_signup(user_id=self.referrer.id, raw_code=self.code.code)
        self.assertEqual(ctx.exception.code, "cannot_use_own_referral")

    def test_rejects_duplicate_application(self):
        apply_referral_on_signup(user_id=self.new_user.id, raw_code=self.code.code)
        other = User.objects.create_user(username="other", password="pass")
        ReferralCode.objects.create(user=other, code="OTHER99")

        with self.assertRaises(ReferralApplyError) as ctx:
            apply_referral_on_signup(user_id=self.new_user.id, raw_code="OTHER99")
        self.assertEqual(ctx.exception.code, "referral_already_applied")
