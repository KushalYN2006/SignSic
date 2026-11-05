import numpy as np
import librosa


def estimate_tuning(audio: np.ndarray, sample_rate: int, hop_length: int,
                    fractional_midi: np.ndarray | None = None) -> tuple[float, float]:
    """Return detected tuning offset in cents and semitones, refined against voiced f0."""
    if fractional_midi is not None:
        valid = np.asarray(fractional_midi, dtype=float)
        valid = valid[np.isfinite(valid)]
        if valid.size:
            try:
                coarse = float(librosa.estimate_tuning(y=audio, sr=sample_rate, hop_length=hop_length))
            except (ValueError, TypeError):
                coarse = 0.0
            residual = (valid + 0.5) % 1.0 - 0.5
            # Pitch-class tuning is a circular offset. Centering each f0 on its
            # nearest equal-tempered semitone avoids chroma-bin bias from pure tones.
            offset = float(np.median(residual))
        else:
            offset = 0.0
    else:
        try:
            offset = float(librosa.estimate_tuning(y=audio, sr=sample_rate, hop_length=hop_length))
        except (ValueError, TypeError):
            offset = 0.0
    if abs(offset) < 0.005:
        offset = 0.0
    return offset * 100.0, offset
