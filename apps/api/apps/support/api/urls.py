from django.urls import path

from apps.support.api.views import (
    SupportCategoriesView,
    SupportStaffUsersView,
    SupportTicketDetailView,
    SupportTicketMessagesView,
    SupportTicketsView,
)

urlpatterns = [
    path("support/categories", SupportCategoriesView.as_view()),
    path("support/tickets", SupportTicketsView.as_view()),
    path("support/tickets/<int:ticket_id>", SupportTicketDetailView.as_view()),
    path("support/tickets/<int:ticket_id>/messages", SupportTicketMessagesView.as_view()),
    path("support/staff-users", SupportStaffUsersView.as_view()),
]
