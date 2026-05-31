from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.social.services.avatar import validate_avatar_upload


class AvatarValidationTests(SimpleTestCase):
    def test_accepts_gif(self):
        f = SimpleUploadedFile("a.gif", b"GIF89a", content_type="image/gif")
        validate_avatar_upload(f)

    def test_rejects_oversized(self):
        f = SimpleUploadedFile("big.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png")
        with self.assertRaises(ValidationError) as ctx:
            validate_avatar_upload(f)
        self.assertIn("avatar_too_large", str(ctx.exception))

    def test_rejects_bad_type(self):
        f = SimpleUploadedFile("a.pdf", b"%PDF", content_type="application/pdf")
        with self.assertRaises(ValidationError) as ctx:
            validate_avatar_upload(f)
        self.assertIn("avatar_invalid", str(ctx.exception))
