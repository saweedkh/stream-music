"""Support ticket business logic and JSON shapes."""

from __future__ import annotations

import time

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone

from apps.accounts.user_badges import user_badge_flags
from apps.support.models import SupportMessage, SupportTicket, SupportTicketRead

_SUPPORT_SEND_TS: dict[tuple[int, int], list[float]] = {}
_SUPPORT_SEND_WINDOW = 30
_SUPPORT_SEND_MAX = 15
_MAX_OPEN_TICKETS_PER_USER = 25
_MESSAGE_MAX_LEN = 8000


def is_support_staff(user) -> bool:
    return bool(
        getattr(user, "is_authenticated", False)
        and (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))
    )


def can_access_ticket(ticket_id: int, user_id: int) -> bool:
    ticket = SupportTicket.objects.filter(id=ticket_id).only("id", "requester_id").first()
    if ticket is None:
        return False
    if ticket.requester_id == user_id:
        return True
    return User.objects.filter(id=user_id, is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True)).exists()


def _rate_ok(ticket_id: int, user_id: int) -> bool:
    now = time.time()
    key = (ticket_id, user_id)
    hits = [t for t in _SUPPORT_SEND_TS.get(key, []) if now - t < _SUPPORT_SEND_WINDOW]
    if len(hits) >= _SUPPORT_SEND_MAX:
        _SUPPORT_SEND_TS[key] = hits
        return False
    hits.append(now)
    _SUPPORT_SEND_TS[key] = hits
    return True


def _author_dict(user) -> dict:
    if user is None:
        return {"id": None, "username": "?"}
    return {"id": user.id, "username": user.username, **user_badge_flags(user)}


def _unread_count(ticket: SupportTicket, user_id: int, *, staff_view: bool) -> int:
    last_read = (
        SupportTicketRead.objects.filter(ticket_id=ticket.id, user_id=user_id)
        .values_list("last_read_message_id", flat=True)
        .first()
    ) or 0
    qs = SupportMessage.objects.filter(ticket_id=ticket.id, id__gt=last_read)
    if not staff_view:
        qs = qs.filter(is_internal=False)
    if staff_view:
        qs = qs.exclude(author_id=user_id)
    return qs.count()


def ticket_to_dict(ticket: SupportTicket, *, viewer: User, include_requester: bool = False) -> dict:
    staff_view = is_support_staff(viewer)
    data = {
        "id": ticket.id,
        "reference": ticket.reference,
        "subject": ticket.subject,
        "category": ticket.category,
        "status": ticket.status,
        "priority": ticket.priority,
        "assigned_to_id": ticket.assigned_to_id,
        "assigned_to_username": ticket.assigned_to.username if ticket.assigned_to_id and ticket.assigned_to else None,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
        "last_message_at": ticket.last_message_at.isoformat() if ticket.last_message_at else None,
        "last_message_preview": ticket.last_message_preview or "",
        "unread_count": _unread_count(ticket, viewer.id, staff_view=staff_view),
        "is_mine": ticket.requester_id == viewer.id,
    }
    if include_requester or staff_view:
        data["requester_id"] = ticket.requester_id
        data["requester_username"] = ticket.requester.username if ticket.requester_id and ticket.requester else None
        if ticket.requester:
            data["requester"] = _author_dict(ticket.requester)
    return data


def message_to_dict(msg: SupportMessage, *, viewer: User) -> dict:
    staff_view = is_support_staff(viewer)
    if msg.is_internal and not staff_view:
        return {}
    return {
        "id": msg.id,
        "ticket_id": msg.ticket_id,
        "author_id": msg.author_id,
        "author": _author_dict(msg.author),
        "body": msg.body or "",
        "is_internal": bool(msg.is_internal),
        "is_mine": msg.author_id == viewer.id,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
    }


def fetch_ticket_messages(ticket_id: int, viewer: User, *, limit: int = 80, before_id: int | None = None) -> list[dict]:
    lim = max(1, min(100, limit))
    qs = SupportMessage.objects.filter(ticket_id=ticket_id).select_related("author").order_by("-id")
    if not is_support_staff(viewer):
        qs = qs.filter(is_internal=False)
    if before_id is not None:
        qs = qs.filter(id__lt=before_id)
    rows = list(qs[:lim])
    rows.reverse()
    out = []
    for row in rows:
        d = message_to_dict(row, viewer=viewer)
        if d:
            out.append(d)
    return out


def mark_ticket_read(ticket_id: int, user_id: int, message_id: int | None = None) -> None:
    if message_id is None:
        message_id = SupportMessage.objects.filter(ticket_id=ticket_id).aggregate(m=Max("id")).get("m") or 0
    SupportTicketRead.objects.update_or_create(
        ticket_id=ticket_id,
        user_id=user_id,
        defaults={"last_read_message_id": message_id},
    )


def _touch_ticket_from_message(ticket: SupportTicket, msg: SupportMessage, *, status_hint: str | None = None) -> None:
    preview = (msg.body or "").replace("\n", " ").strip()[:280]
    ticket.last_message_at = msg.created_at or timezone.now()
    ticket.last_message_preview = preview
    update_fields = ["last_message_at", "last_message_preview", "updated_at"]
    if status_hint and ticket.status not in (SupportTicket.Status.RESOLVED, SupportTicket.Status.CLOSED):
        ticket.status = status_hint
        update_fields.append("status")
    ticket.save(update_fields=update_fields)


@transaction.atomic
def create_ticket(
    user: User,
    *,
    subject: str,
    category: str,
    body: str,
    priority: str = SupportTicket.Priority.NORMAL,
) -> tuple[SupportTicket | None, SupportMessage | None, str | None]:
    subj = (subject or "").strip()[:200]
    raw_body = (body or "").strip()
    if not subj or not raw_body or len(raw_body) > _MESSAGE_MAX_LEN:
        return None, None, "invalid_payload"

    open_count = SupportTicket.objects.filter(
        requester_id=user.id,
        status__in=[
            SupportTicket.Status.OPEN,
            SupportTicket.Status.IN_PROGRESS,
            SupportTicket.Status.WAITING_USER,
            SupportTicket.Status.WAITING_STAFF,
        ],
    ).count()
    if open_count >= _MAX_OPEN_TICKETS_PER_USER:
        return None, None, "too_many_open"

    cat = category if category in SupportTicket.Category.values else SupportTicket.Category.GENERAL
    pri = priority if priority in SupportTicket.Priority.values else SupportTicket.Priority.NORMAL

    ticket = SupportTicket.objects.create(
        requester=user,
        subject=subj,
        category=cat,
        priority=pri,
        status=SupportTicket.Status.OPEN,
    )
    ticket = SupportTicket.objects.select_related("requester", "assigned_to").get(id=ticket.id)
    msg = SupportMessage.objects.create(ticket=ticket, author=user, body=raw_body)
    msg = SupportMessage.objects.select_related("author").get(id=msg.id)
    _touch_ticket_from_message(ticket, msg, status_hint=SupportTicket.Status.WAITING_STAFF)
    mark_ticket_read(ticket.id, user.id, msg.id)
    return ticket, msg, None


def apply_send_message(
    ticket_id: int,
    user: User,
    body: str,
    *,
    is_internal: bool = False,
) -> tuple[dict | None, dict | None, str | None]:
    raw = (body or "").strip()
    if not raw or len(raw) > _MESSAGE_MAX_LEN:
        return None, None, "invalid_body"
    if not _rate_ok(ticket_id, user.id):
        return None, None, "rate_limited"

    ticket = SupportTicket.objects.select_related("requester", "assigned_to").filter(id=ticket_id).first()
    if ticket is None:
        return None, None, "not_found"
    if not can_access_ticket(ticket_id, user.id):
        return None, None, "forbidden"
    if ticket.status == SupportTicket.Status.CLOSED:
        return None, None, "ticket_closed"

    staff = is_support_staff(user)
    if is_internal and not staff:
        return None, None, "forbidden"

    if not staff and ticket.requester_id != user.id:
        return None, None, "forbidden"

    msg = SupportMessage.objects.create(ticket=ticket, author=user, body=raw, is_internal=is_internal)
    msg = SupportMessage.objects.select_related("author").get(id=msg.id)

    if is_internal:
        status_hint = None
    elif staff:
        status_hint = SupportTicket.Status.WAITING_USER
    else:
        status_hint = SupportTicket.Status.WAITING_STAFF
        if ticket.status == SupportTicket.Status.RESOLVED:
            status_hint = SupportTicket.Status.OPEN

    _touch_ticket_from_message(ticket, msg, status_hint=status_hint)
    ticket.refresh_from_db()
    mark_ticket_read(ticket_id, user.id, msg.id)
    return message_to_dict(msg, viewer=user), ticket_to_dict(ticket, viewer=user, include_requester=True), None


def patch_ticket(ticket_id: int, user: User, data: dict) -> tuple[SupportTicket | None, str | None]:
    ticket = SupportTicket.objects.select_related("requester", "assigned_to").filter(id=ticket_id).first()
    if ticket is None:
        return None, "not_found"
    if not can_access_ticket(ticket_id, user.id):
        return None, "forbidden"

    staff = is_support_staff(user)
    update_fields: list[str] = []

    if staff:
        if "status" in data:
            st = str(data["status"])
            if st in SupportTicket.Status.values:
                ticket.status = st
                update_fields.append("status")
                if st == SupportTicket.Status.CLOSED:
                    ticket.closed_at = timezone.now()
                    update_fields.append("closed_at")
                elif ticket.closed_at:
                    ticket.closed_at = None
                    update_fields.append("closed_at")
        if "priority" in data:
            pr = str(data["priority"])
            if pr in SupportTicket.Priority.values:
                ticket.priority = pr
                update_fields.append("priority")
        if "assigned_to_id" in data:
            raw = data["assigned_to_id"]
            if raw is None or raw == "":
                ticket.assigned_to_id = None
                update_fields.append("assigned_to_id")
            else:
                try:
                    aid = int(raw)
                except (TypeError, ValueError):
                    return None, "invalid_assignee"
                assignee = (
                    User.objects.filter(id=aid, is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True)).first()
                )
                if assignee is None:
                    return None, "invalid_assignee"
                ticket.assigned_to_id = assignee.id
                update_fields.append("assigned_to_id")
                if ticket.status == SupportTicket.Status.OPEN:
                    ticket.status = SupportTicket.Status.IN_PROGRESS
                    update_fields.append("status")
        if "category" in data:
            cat = str(data["category"])
            if cat in SupportTicket.Category.values:
                ticket.category = cat
                update_fields.append("category")
    else:
        if "status" in data and str(data["status"]) in (SupportTicket.Status.CLOSED, SupportTicket.Status.RESOLVED):
            ticket.status = str(data["status"])
            update_fields.append("status")
            if ticket.status == SupportTicket.Status.CLOSED:
                ticket.closed_at = timezone.now()
                update_fields.append("closed_at")

    if update_fields:
        ticket.save(update_fields=list(dict.fromkeys([*update_fields, "updated_at"])))
    return ticket, None


def list_tickets_for_user(user: User, *, status: str | None = None, search: str = "", limit: int = 50, offset: int = 0):
    staff = is_support_staff(user)
    qs = SupportTicket.objects.select_related("requester", "assigned_to")
    if staff:
        if status and status != "all":
            qs = qs.filter(status=status)
    else:
        qs = qs.filter(requester_id=user.id)
        if status and status != "all":
            qs = qs.filter(status=status)
    q = (search or "").strip()
    if q:
        qs = qs.filter(Q(subject__icontains=q) | Q(reference__icontains=q) | Q(requester__username__icontains=q))
    total = qs.count()
    rows = list(qs[offset : offset + limit])
    return [ticket_to_dict(t, viewer=user, include_requester=staff) for t in rows], total


def support_categories_payload() -> list[dict]:
    return [{"id": c.value, "label": c.label} for c in SupportTicket.Category]


def broadcast_staff_inbox(ticket_dict: dict) -> None:
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        from apps.support.consumers import STAFF_INBOX_GROUP

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            STAFF_INBOX_GROUP,
            {"type": "inbox_fanout", "payload": {"type": "SUPPORT_INBOX", "ticket": ticket_dict}},
        )
    except Exception:
        pass


def staff_inbox_stats() -> dict:
    base = SupportTicket.objects.all()
    by_status = dict(base.values("status").annotate(c=Count("id")).values_list("status", "c"))
    return {
        "open": by_status.get(SupportTicket.Status.OPEN, 0),
        "in_progress": by_status.get(SupportTicket.Status.IN_PROGRESS, 0),
        "waiting_staff": by_status.get(SupportTicket.Status.WAITING_STAFF, 0),
        "waiting_user": by_status.get(SupportTicket.Status.WAITING_USER, 0),
        "total_active": base.exclude(status__in=[SupportTicket.Status.CLOSED, SupportTicket.Status.RESOLVED]).count(),
    }
