"""Shared date-range parsing for admin list queries."""

from __future__ import annotations

from datetime import date, datetime, time

from django.utils import timezone


def parse_date_param(value: str) -> date | None:
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def date_range_bounds(date_from: str = "", date_to: str = "") -> tuple[datetime | None, datetime | None]:
    start_day = parse_date_param(date_from)
    end_day = parse_date_param(date_to)
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(start_day, time.min), tz) if start_day else None
    end = timezone.make_aware(datetime.combine(end_day, time.max), tz) if end_day else None
    return start, end


def filter_created_at(qs, *, date_from: str = "", date_to: str = ""):
    start, end = date_range_bounds(date_from, date_to)
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    if end is not None:
        qs = qs.filter(created_at__lte=end)
    return qs
