from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.channels.services.brand_media import validate_brand_logo_upload


class BrandLogoValidationTests(SimpleTestCase):
    def test_accepts_gif(self):
        f = SimpleUploadedFile("logo.gif", b"GIF89a", content_type="image/gif")
        validate_brand_logo_upload(f)

    def test_accepts_mp4(self):
        f = SimpleUploadedFile("clip.mp4", b"\x00\x00\x00\x20ftyp", content_type="video/mp4")
        validate_brand_logo_upload(f)

    def test_rejects_oversized_image(self):
        f = SimpleUploadedFile("big.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png")
        with self.assertRaises(ValidationError) as ctx:
            validate_brand_logo_upload(f)
        self.assertIn("brand_logo_too_large", str(ctx.exception))

    def test_rejects_oversized_video(self):
        f = SimpleUploadedFile("big.mp4", b"x" * (20 * 1024 * 1024 + 1), content_type="video/mp4")
        with self.assertRaises(ValidationError) as ctx:
            validate_brand_logo_upload(f)
        self.assertIn("brand_logo_video_too_large", str(ctx.exception))

    def test_rejects_bad_type(self):
        f = SimpleUploadedFile("a.pdf", b"%PDF", content_type="application/pdf")
        with self.assertRaises(ValidationError) as ctx:
            validate_brand_logo_upload(f)
        self.assertIn("brand_logo_invalid", str(ctx.exception))
