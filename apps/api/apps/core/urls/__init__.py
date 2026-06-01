from django.conf import settings
from django.urls import path

from apps.core.auth.csrf.csrf_api import auth_csrf
from apps.core.auth.login.login_api import LoginView
from apps.core.auth.logout.logout_api import LogoutView
from apps.core.auth.me.me_api import MeView
from apps.core.auth.me.notification_settings.notification_settings_api import UserNotificationSettingsView
from apps.core.auth.me.password.password_api import UserPasswordChangeView
from apps.core.auth.me.push_subscription.push_subscription_api import WebPushSubscriptionView
from apps.core.auth.me.push_test.push_test_api import WebPushTestView
from apps.core.auth.register.register_api import RegisterView
from apps.core.auth.username_available.username_available_api import UsernameAvailabilityView
from apps.core.auth.users.users_api import UsersListView
from apps.core.health.health_api import HealthView
from apps.core.metrics.metrics_api import MetricsView
from apps.core.schema.schema_api import OpenApiSchemaView
from apps.core.time.time_api import api_time

urlpatterns = [
    path("health", HealthView.as_view()),
    path("metrics", MetricsView.as_view()),
    path("schema", OpenApiSchemaView.as_view()),
    path("schema/openapi.json", OpenApiSchemaView.as_view()),
    path("time", api_time),
    path("auth/csrf", auth_csrf),
    path("auth/register", RegisterView.as_view()),
    path("auth/username-available", UsernameAvailabilityView.as_view()),
    path("auth/login", LoginView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/me", MeView.as_view()),
    path("auth/me/password", UserPasswordChangeView.as_view()),
    path("auth/me/notification-settings", UserNotificationSettingsView.as_view()),
    path("auth/me/push-subscription", WebPushSubscriptionView.as_view()),
    path("auth/me/push-test", WebPushTestView.as_view()),
    path("auth/users", UsersListView.as_view()),
]

if getattr(settings, "E2E_RATE_LIMIT_OFF", False):
    from apps.core.e2e.e2e_helpers_api import E2EPremiumCodeView

    urlpatterns.append(path("e2e/premium-code", E2EPremiumCodeView.as_view()))
