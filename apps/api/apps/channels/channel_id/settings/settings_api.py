"""Channel API — ChannelSettingsView."""

import json

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.constants import ALLOWED_EXPERIENCE_KEYS
from apps.channels.helpers import (
    _log_channel_audit,
    _normalize_public_join_slug_for_save,
)
from apps.channels.models import (
    Channel,
)
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import (
    ChannelSerializer,
)


class ChannelSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def patch(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        update_fields = []
        for field in ["name", "description", "privacy", "join_requires_approval"]:
            if field in request.data:
                setattr(channel, field, request.data[field])
                update_fields.append(field)
        if "member_limit" in request.data:
            from apps.accounts.premium_limits import clamp_member_limit

            channel.member_limit = clamp_member_limit(
                channel.owner, request.data.get("member_limit", channel.member_limit)
            )
            update_fields.append("member_limit")
        if "public_join_slug" in request.data:
            if channel.privacy == Channel.Privacy.PRIVATE:
                if _normalize_public_join_slug_for_save(request.data.get("public_join_slug")) not in (None, False):
                    return Response({"detail": "public_join_slug_not_allowed"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                normalized = _normalize_public_join_slug_for_save(request.data.get("public_join_slug"))
                if normalized is False:
                    return Response({"detail": "invalid_public_join_slug"}, status=status.HTTP_400_BAD_REQUEST)
                if normalized is None:
                    channel.public_join_slug = None
                else:
                    taken = Channel.objects.exclude(pk=channel.pk).filter(public_join_slug__iexact=normalized).exists()
                    if taken:
                        return Response({"detail": "public_join_slug_taken"}, status=status.HTTP_400_BAD_REQUEST)
                    channel.public_join_slug = normalized
                update_fields.append("public_join_slug")
        if channel.privacy == Channel.Privacy.PRIVATE and channel.public_join_slug:
            channel.public_join_slug = None
            if "public_join_slug" not in update_fields:
                update_fields.append("public_join_slug")
        if "experience" in request.data:
            raw = request.data.get("experience")
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except json.JSONDecodeError:
                    return Response({"detail": "invalid_experience"}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(raw, dict):
                ex = dict(channel.experience or {})
                for k, v in raw.items():
                    if k not in ALLOWED_EXPERIENCE_KEYS:
                        continue
                    if k == "chat_word_filters" and isinstance(v, list):
                        ex[k] = [str(w).strip().lower()[:64] for w in v if str(w).strip()][:50]
                    else:
                        ex[k] = v
                channel.experience = ex
                update_fields.append("experience")
        if "brand_logo" in getattr(request, "FILES", {}):
            channel.brand_logo = request.FILES["brand_logo"]
            update_fields.append("brand_logo")
        if not update_fields:
            return Response(ChannelSerializer(channel, context={"request": request}).data)
        update_fields.append("updated_at")
        channel.save(update_fields=list(dict.fromkeys(update_fields)))
        _log_channel_audit(
            channel.id,
            "channel.settings_updated",
            request.user.id,
            target_type="channel",
            target_id=channel.id,
            metadata={"fields": list(dict.fromkeys(update_fields))},
        )
        return Response(ChannelSerializer(channel, context={"request": request}).data)
