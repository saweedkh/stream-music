"""Backward-compatible re-exports (moved to apps.support.api.views)."""

from apps.support.api.views import (  # noqa: F401
    SupportCategoriesView,
    SupportStaffUsersView,
    SupportTicketDetailView,
    SupportTicketMessagesView,
    SupportTicketsView,
)
