import statistics
import time
from dataclasses import dataclass, field


@dataclass
class ClockEstimator:
    offsets: list[float] = field(default_factory=list)

    def add_sample(self, client_sent_ms: float, client_received_ms: float, server_time_ms: float) -> float:
        latency = (client_received_ms - client_sent_ms) / 2
        offset = server_time_ms - (client_sent_ms + latency)
        self.offsets.append(offset)
        self.offsets = self.offsets[-10:]
        return self.best_offset()

    def best_offset(self) -> float:
        if not self.offsets:
            return 0.0
        return statistics.median(self.offsets)


def server_time_seconds() -> float:
    return time.time()


def expected_track_position(started_at_server_time: float, offset_ms: float, now_ms: float) -> float:
    return max(0.0, (now_ms + offset_ms) / 1000 - started_at_server_time)


def correction_mode(diff_seconds: float) -> str:
    abs_diff = abs(diff_seconds)
    if abs_diff > 0.1:
        return "hard_seek"
    if abs_diff > 0.04:
        return "smooth_rate"
    return "none"
