"""REST API for support tickets."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.support_models import SupportTicket
from apps.common.support_service import (
    apply_send_message,
    broadcast_staff_inbox,
    can_access_ticket,
    create_ticket,
    fetch_ticket_messages,
    is_support_staff,
    list_tickets_for_user,
    mark_ticket_read,
    message_to_dict,
    patch_ticket,
    staff_inbox_stats,
    support_categories_payload,
    ticket_to_dict,
)


class SupportCategoriesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"categories": support_categories_payload()})


class SupportTicketsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "all").strip()
        search = (request.query_params.get("search") or "").strip()
        try:
            limit = max(1, min(int(request.query_params.get("limit", "50")), 100))
        except (TypeError, ValueError):
            limit = 50
        try:
            offset = max(0, int(request.query_params.get("offset", "0")))
        except (TypeError, ValueError):
            offset = 0
        results, total = list_tickets_for_user(
            request.user, status=status_filter, search=search, limit=limit, offset=offset
        )
        body = {"results": results, "total": total, "offset": offset, "limit": limit}
        if is_support_staff(request.user):
            body["stats"] = staff_inbox_stats()
        return Response(body)

    def post(self, request):
        subject = request.data.get("subject")
        category = request.data.get("category")
        body = request.data.get("body")
        priority = request.data.get("priority") or SupportTicket.Priority.NORMAL
        ticket, msg, err = create_ticket(
            request.user,
            subject=str(subject or ""),
            category=str(category or ""),
            body=str(body or ""),
            priority=str(priority),
        )
        if err:
            code = status.HTTP_400_BAD_REQUEST
            if err == "too_many_open":
                code = status.HTTP_429_TOO_MANY_REQUESTS
            return Response({"detail": err}, status=code)
        ticket_payload = ticket_to_dict(ticket, viewer=request.user, include_requester=True)
        broadcast_staff_inbox(ticket_payload)
        return Response(
            {
                "ticket": ticket_payload,
                "message": message_to_dict(msg, viewer=request.user),
            },
            status=status.HTTP_201_CREATED,
        )


class SupportTicketDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, ticket_id: int):
        if not can_access_ticket(ticket_id, request.user.id):
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        ticket = SupportTicket.objects.select_related("requester", "assigned_to").filter(id=ticket_id).first()
        if ticket is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        mark_ticket_read(ticket_id, request.user.id)
        return Response(
            {"ticket": ticket_to_dict(ticket, viewer=request.user, include_requester=is_support_staff(request.user))}
        )

    def patch(self, request, ticket_id: int):
        ticket, err = patch_ticket(ticket_id, request.user, request.data)
        if err == "not_found":
            return Response({"detail": err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"ticket": ticket_to_dict(ticket, viewer=request.user, include_requester=is_support_staff(request.user))}
        )


class SupportTicketMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, ticket_id: int):
        if not can_access_ticket(ticket_id, request.user.id):
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            limit = max(1, min(int(request.query_params.get("limit", "80")), 100))
        except (TypeError, ValueError):
            limit = 80
        before_raw = request.query_params.get("before")
        before_id = int(before_raw) if before_raw not in (None, "") else None
        rows = fetch_ticket_messages(ticket_id, request.user, limit=limit, before_id=before_id)
        return Response({"messages": rows})

    def post(self, request, ticket_id: int):
        body = request.data.get("body")
        is_internal = bool(request.data.get("is_internal"))
        msg_dict, ticket_dict, err = apply_send_message(
            ticket_id, request.user, str(body or ""), is_internal=is_internal
        )
        if err == "not_found":
            return Response({"detail": err}, status=status.HTTP_404_NOT_FOUND)
        if err == "forbidden":
            return Response({"detail": err}, status=status.HTTP_403_FORBIDDEN)
        if err == "rate_limited":
            return Response({"detail": err}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        if ticket_dict:
            broadcast_staff_inbox(ticket_dict)
        return Response({"message": msg_dict, "ticket": ticket_dict}, status=status.HTTP_201_CREATED)


class SupportStaffUsersView(APIView):
    """Staff list for assignment dropdown."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_support_staff(request.user):
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        rows = (
            User.objects.filter(is_active=True)
            .filter(Q(is_staff=True) | Q(is_superuser=True))
            .order_by("username")
            .values("id", "username")[:100]
        )
        return Response({"results": list(rows)})
