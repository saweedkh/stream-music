from django.urls import path

from apps.integrations.me.api_tokens.api_tokens_api import MeApiTokensView
from apps.integrations.me.webhooks.webhooks_api import MeWebhooksView
from apps.integrations.public.v1.channels.channels_api import PublicChannelsListView

urlpatterns = [
    path("me/webhooks", MeWebhooksView.as_view()),
    path("me/api-tokens", MeApiTokensView.as_view()),
    path("public/v1/channels", PublicChannelsListView.as_view()),
]
