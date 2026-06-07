"""CSV download helpers for admin exports."""

from __future__ import annotations

import csv

from django.http import HttpResponse


def admin_csv_response(*, filename: str, headers: list[str], rows: list[list]) -> HttpResponse:
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response
