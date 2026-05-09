import re
from urllib.parse import urlparse

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware, RejectRequest


def _compiled_lan_origin_patterns() -> list[re.Pattern[str]]:
    raw = getattr(settings, "DEBUG_TRUSTED_ORIGIN_REGEXES", ())
    return [re.compile(p) for p in raw]


class LanTrustedCsrfMiddleware(CsrfViewMiddleware):
    """Trust private-network Origin/Referer when LAN_ORIGIN_REGEX_ENABLED (same patterns as CORS)."""

    @staticmethod
    def _lan_regex_origin_allowed(origin: str) -> bool:
        if not getattr(settings, "LAN_ORIGIN_REGEX_ENABLED", False) or not origin:
            return False
        return any(rx.match(origin) for rx in _compiled_lan_origin_patterns())

    def _origin_verified(self, request):
        if super()._origin_verified(request):
            return True
        return self._lan_regex_origin_allowed(request.META.get("HTTP_ORIGIN", ""))

    def _check_referer(self, request):
        if not getattr(settings, "LAN_ORIGIN_REGEX_ENABLED", False):
            super()._check_referer(request)
            return
        try:
            super()._check_referer(request)
        except RejectRequest:
            referer = request.META.get("HTTP_REFERER")
            if referer:
                parsed = urlparse(referer)
                if parsed.scheme and parsed.netloc:
                    origin = f"{parsed.scheme}://{parsed.netloc}"
                    if self._lan_regex_origin_allowed(origin):
                        return
            raise
