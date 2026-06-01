"""
DRF SessionAuthentication runs CSRF again via CSRFCheck (subclasses CsrfViewMiddleware).

That bypasses LanTrustedCsrfMiddleware (LAN Origin regex). Use the same logic here.
"""

from rest_framework import exceptions
from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication

from config.csrf_middleware import LanTrustedCsrfMiddleware


class LanTrustedCsrfCheck(LanTrustedCsrfMiddleware):
    """Mirrors rest_framework.authentication.CSRFCheck — returns failure reason instead of HttpResponse."""

    def _reject(self, request, reason):
        return reason


class LanSessionAuthentication(DRFSessionAuthentication):
    def enforce_csrf(self, request):
        def dummy_get_response(req):
            return None

        check = LanTrustedCsrfCheck(dummy_get_response)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
