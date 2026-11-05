from dataclasses import dataclass
import numpy as np


@dataclass
class PitchTrack:
    midi: np.ndarray
    voiced: np.ndarray
    probability: np.ndarray
    hop_length: int
    sample_rate: int


class PitchEngine:
    name = "base"

    def track(self, audio: np.ndarray, sample_rate: int) -> PitchTrack:
        raise NotImplementedError
