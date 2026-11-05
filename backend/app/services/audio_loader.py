from pathlib import Path
import numpy as np
import librosa
import soundfile as sf

from app.config import SAMPLE_RATE, MAX_DURATION_S


class AudioLoadError(ValueError):
    pass


def load_audio(path: str | Path) -> tuple[np.ndarray, float, float, bool]:
    try:
        if Path(path).suffix.lower() == ".wav":
            raw, source_rate = sf.read(path, dtype="float32", always_2d=True)
            audio = raw.mean(axis=1)
            if source_rate != SAMPLE_RATE:
                audio = librosa.resample(audio, orig_sr=source_rate, target_sr=SAMPLE_RATE)
        else:
            audio, source_rate = librosa.load(path, sr=SAMPLE_RATE, mono=True, dtype=np.float32)
    except Exception as exc:
        raise AudioLoadError("The uploaded file could not be decoded as audio.") from exc
    duration = len(audio) / SAMPLE_RATE
    if duration > MAX_DURATION_S:
        raise AudioLoadError("Audio is longer than the 60 second limit.")
    if not len(audio) or not np.isfinite(audio).all():
        raise AudioLoadError("The uploaded file contains no readable audio.")
    clipped = bool(np.mean(np.abs(audio) >= 0.999) > 0.01)
    peak = float(np.max(np.abs(audio)))
    if peak:
        audio = audio / peak
    active = np.flatnonzero(np.abs(audio) > 0.008)
    offset_s = 0.0
    if active.size:
        padding = int(0.05 * SAMPLE_RATE)
        start = max(0, int(active[0]) - padding)
        end = min(len(audio), int(active[-1]) + padding + 1)
        offset_s = start / SAMPLE_RATE
        audio = audio[start:end]
    return audio.astype(np.float32), duration, offset_s, clipped
