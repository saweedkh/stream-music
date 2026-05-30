"""External source parsing helpers for channel room."""

from __future__ import annotations

import re

_SPOTIFY_RE = re.compile(r"(?:open\.)?spotify\.com/(?:track|album|playlist)/", re.I)
_YOUTUBE_RE = re.compile(r"(?:youtube\.com/watch|youtu\.be/)", re.I)


def parse_external_source(url: str) -> tuple[str, str, str, str]:
    raw = (url or "").strip()
    if not raw:
        return "", "", "", ""
    source = ""
    if _SPOTIFY_RE.search(raw):
        source = "spotify"
    elif _YOUTUBE_RE.search(raw):
        source = "youtube"
    else:
        source = "link"
    title = str(raw).split("/")[-1].split("?")[0][:255] or "External link"
    return raw[:500], title, "", source
