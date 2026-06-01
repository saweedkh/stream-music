"""Settings package — use config.settings as DJANGO_SETTINGS_MODULE entrypoint."""

import os

from config.settings.base import *  # noqa: F403

_env = os.getenv("DJANGO_ENV", "").strip().lower()
if _env == "production":
    from config.settings.production import *  # noqa: F403
elif _env == "local":
    from config.settings.local import *  # noqa: F403
