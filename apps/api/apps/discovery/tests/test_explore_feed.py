from django.test import SimpleTestCase

from apps.discovery.services import explore_feed


class ExploreFeedServiceTests(SimpleTestCase):
    def test_build_explore_feed_is_callable(self):
        self.assertTrue(callable(explore_feed.build_explore_feed))
