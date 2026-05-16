import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_truthy(key: str, default: str = "0") -> bool:
    return os.getenv(key, default).strip().lower() in ("1", "true", "yes", "on")


SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
DEBUG = _env_truthy("DEBUG")
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h.strip()]

SESSION_COOKIE_SECURE = _env_truthy("SESSION_COOKIE_SECURE", "1" if not DEBUG else "0")
CSRF_COOKIE_SECURE = _env_truthy("CSRF_COOKIE_SECURE", "1" if not DEBUG else "0")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "channels",
    "corsheaders",
    "apps.channels.apps.ChannelsConfig",
    "apps.tracks",
    "apps.playlists",
    "apps.playback",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "config.rate_limit_middleware.SimpleRateLimitMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "config.csrf_middleware.LanTrustedCsrfMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "stream_music"),
        "USER": os.getenv("POSTGRES_USER", "stream_music"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "stream_music"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "config.authentication.LanSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/audio/"
MEDIA_ROOT = os.getenv("MEDIA_ROOT", str(BASE_DIR / "media"))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Stream large uploads to disk instead of buffering entirely in memory (multipart handlers).
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", str(2 * 1024 * 1024)))
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(50 * 1024 * 1024)))

CHUNK_UPLOAD_ROOT = os.getenv("CHUNK_UPLOAD_ROOT", os.path.join(MEDIA_ROOT, "chunk_uploads"))
CHUNK_UPLOAD_MAX_BYTES = int(os.getenv("CHUNK_UPLOAD_MAX_BYTES", str(500 * 1024 * 1024)))
CHUNK_UPLOAD_CHUNK_MAX_BYTES = int(os.getenv("CHUNK_UPLOAD_CHUNK_MAX_BYTES", str(8 * 1024 * 1024)))

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://localhost:8443",
    "https://127.0.0.1:8443",
]
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

# Comma-separated, e.g. "http://192.168.1.10:8080,https://172.20.10.2:8443" for phone on LAN (CSRF needs exact origin).
_extra_origins = [o.strip() for o in os.getenv("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()]
if _extra_origins:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys([*CORS_ALLOWED_ORIGINS, *_extra_origins]))
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys([*CSRF_TRUSTED_ORIGINS, *_extra_origins]))

# Private LAN origins: CORS regex + LanTrustedCsrfMiddleware. Enabled when DEBUG or TRUST_LAN_CSRF (see .env.example).
LAN_ORIGIN_REGEX_ENABLED = DEBUG or _env_truthy("TRUST_LAN_CSRF")
DEBUG_TRUSTED_ORIGIN_REGEXES: tuple[str, ...] = ()
if LAN_ORIGIN_REGEX_ENABLED:
    DEBUG_TRUSTED_ORIGIN_REGEXES = (
        r"^http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$",
        r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$",
        r"^http://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$",
        r"^https://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$",
        r"^https://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$",
        r"^https://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$",
    )
    CORS_ALLOWED_ORIGIN_REGEXES = list(DEBUG_TRUSTED_ORIGIN_REGEXES)

# Nginx terminates TLS and forwards to Django; keeps request.is_secure() and cookies consistent for HTTPS clients.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Absolute base URL of the Next.js app (used in web push notification links). LAN example: http://192.168.1.5:3000
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").strip()
# Web Push (VAPID). Generate with: `npx web-push generate-vapid-keys` or `openssl ecparam -name prime256v1 -genkey -noout`
WEBPUSH_VAPID_PUBLIC_KEY = os.getenv("WEBPUSH_VAPID_PUBLIC_KEY", "").strip()
WEBPUSH_VAPID_PRIVATE_KEY = os.getenv("WEBPUSH_VAPID_PRIVATE_KEY", "").strip()
WEBPUSH_VAPID_SUBJECT = os.getenv("WEBPUSH_VAPID_SUBJECT", "mailto:admin@localhost").strip()
