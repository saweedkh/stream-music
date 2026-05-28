from django.test import SimpleTestCase

from apps.playback.services.sync_engine import ClockEstimator, correction_mode


class SyncEngineTests(SimpleTestCase):
    def test_clock_estimator_uses_median(self):
        estimator = ClockEstimator()
        estimator.add_sample(1000, 1200, 1150)
        estimator.add_sample(1000, 1200, 1130)
        estimator.add_sample(1000, 1200, 1140)
        self.assertEqual(estimator.best_offset(), 40)

    def test_correction_mode_thresholds(self):
        self.assertEqual(correction_mode(0.2), "hard_seek")
        self.assertEqual(correction_mode(0.05), "smooth_rate")
        self.assertEqual(correction_mode(0.01), "none")
