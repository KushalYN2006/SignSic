import librosa
import numpy as np

from app.config import FRAME_LENGTH, HOP_LENGTH, SAMPLE_RATE
from .base import PitchEngine, PitchTrack


class PyinEngine(PitchEngine):
    name = "pyin"

    def track(self, audio: np.ndarray, sample_rate: int = SAMPLE_RATE) -> PitchTrack:
        f0, voiced, probability = librosa.pyin(
            audio, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"),
            sr=sample_rate, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH,
        )
        midi = np.full(len(f0), np.nan, dtype=np.float64)
        valid = np.isfinite(f0) & (f0 > 0)
        midi[valid] = librosa.hz_to_midi(f0[valid])
        prob = np.nan_to_num(probability, nan=0.0)
        voiced = np.asarray(voiced, dtype=bool) & (prob >= 0.4)
        return PitchTrack(midi, voiced, prob, HOP_LENGTH, sample_rate)
