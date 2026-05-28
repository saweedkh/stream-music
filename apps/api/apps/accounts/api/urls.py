from django.urls import path

from apps.accounts.api.views import MePublicProfileView, PremiumLimitsView, PublicUserProfileView

urlpatterns = [
    path("auth/me/public-profile", MePublicProfileView.as_view()),
    path("auth/me/premium-limits", PremiumLimitsView.as_view()),
    path("users/<str:username>/profile", PublicUserProfileView.as_view()),
]
