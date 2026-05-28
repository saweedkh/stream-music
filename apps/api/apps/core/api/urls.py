from django.urls import path

from apps.common.views import (
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    UserNotificationSettingsView,
    UserPasswordChangeView,
    UsersListView,
    WebPushSubscriptionView,
    WebPushTestView,
    api_time,
    auth_csrf,
)
from apps.core.api.health import HealthView
from apps.core.api.metrics import MetricsView
from apps.core.api.openapi_schema import OpenApiSchemaView

urlpatterns = [
    path("health", HealthView.as_view()),
    path("metrics", MetricsView.as_view()),
    path("schema", OpenApiSchemaView.as_view()),
    path("time", api_time),
    path("auth/csrf", auth_csrf),
    path("auth/register", RegisterView.as_view()),
    path("auth/login", LoginView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/me", MeView.as_view()),
    path("auth/me/password", UserPasswordChangeView.as_view()),
    path("auth/me/notification-settings", UserNotificationSettingsView.as_view()),
    path("auth/me/push-subscription", WebPushSubscriptionView.as_view()),
    path("auth/me/push-test", WebPushTestView.as_view()),
    path("auth/users", UsersListView.as_view()),
]
