from django.urls import path

from apps.accounts.auth.me.premium_limits.premium_limits_api import PremiumLimitsView
from apps.accounts.auth.me.public_profile.public_profile_api import MePublicProfileView
from apps.accounts.users.profile.profile_api import PublicUserProfileView

urlpatterns = [
    path("auth/me/public-profile", MePublicProfileView.as_view()),
    path("auth/me/premium-limits", PremiumLimitsView.as_view()),
    path("users/<str:username>/profile", PublicUserProfileView.as_view()),
]
