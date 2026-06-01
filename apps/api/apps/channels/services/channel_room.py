"""Small channel room HTTP helpers."""

from rest_framework import status
from rest_framework.response import Response


def channel_closed_response():
    return Response({"detail": "channel_closed"}, status=status.HTTP_410_GONE)
