import numpy as np
from scipy.ndimage import median_filter
import librosa

from app.config import MIN_NOTE_MS
from app.services.transpose import note_fields
from app.services.pitch_engines.base import PitchTrack


def repeated_note_onsets(audio: np.ndarray, candidates: np.ndarray, sample_rate: int, hop_length: int) -> set[int]:
    """Keep distinct attacks that follow a measurable energy dip; collapse duplicate onset peaks."""
    rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=hop_length, center=True)[0]
    accepted: list[int] = []
    for raw in sorted(map(int, candidates)):
        if raw < 2 or raw >= len(rms):
            continue
        before = rms[max(0, raw - 8):raw]
        if not before.size:
            continue
        baseline = float(np.median(before))
        floor = float(np.min(before))
        after = float(rms[min(raw + 1, len(rms) - 1)])
        if baseline <= 0 or floor > baseline * (10 ** (-3 / 20)) or after < floor * 1.4:
            continue
        # onset_detect may emit several peaks for one attack; retain its earliest peak.
        if accepted and raw - accepted[-1] <= max(1, int(0.16 * sample_rate / hop_length)):
            continue
        accepted.append(raw)
    return set(accepted)


def segment_track(track: PitchTrack, offset_s: float = 0.0, onset_frames: set[int] | None = None) -> list[dict]:
    midi = track.midi.copy()
    voiced = track.voiced.copy() & np.isfinite(midi) & (track.probability >= 0.4)
    if voiced.any():
        # Repair brief octave flips that return to the same underlying pitch.
        for idx in range(1, len(midi) - 1):
            if not (voiced[idx - 1] and voiced[idx] and voiced[idx + 1]):
                continue
            baseline = midi[idx - 1]
            if abs(abs(midi[idx] - baseline) - 12) > 0.7:
                continue
            for width in (1, 2):
                end = idx + width
                if end < len(midi) and voiced[idx:end + 1].all() and abs(midi[end] - baseline) <= 0.7 and np.all(np.abs(midi[idx:end] - midi[idx]) <= 0.7):
                    midi[idx:end] = baseline
                    break
        # Filter only voiced values; interpolate briefly over unvoiced frames then restore the mask.
        indices = np.arange(len(midi))
        clean = np.interp(indices, indices[voiced], midi[voiced])
        midi = median_filter(clean, size=5, mode="nearest")
    groups: list[list[int]] = []
    onset_frames = onset_frames or set()
    current: list[int] = []
    pending: list[int] = []
    # Require three consecutive frames outside the running pitch median to
    # reject vibrato and isolated tracking jumps; longer voicing gaps end a note.
    for idx in range(len(midi)):
        if not voiced[idx]:
            if current:
                pending.append(idx)
                if len(pending) <= 2:
                    continue
                groups.append(current)
                current, pending = [], []
            continue
        if not current:
            current = [idx]
            pending = []
            continue
        if idx in onset_frames and abs(midi[idx] - float(np.median(midi[current[-min(len(current), 9):]]))) <= 0.6:
            groups.append(current)
            current = [idx]
            pending = []
            continue
        baseline = float(np.median(midi[current[-min(len(current), 9):]]))
        if abs(midi[idx] - baseline) > 0.6:
            pending.append(idx)
            if len(pending) >= 3:
                changed = [j for j in pending if voiced[j]]
                groups.append(current)
                current = changed or [idx]
                pending = []
        else:
            current.extend(pending)
            current.append(idx)
            pending = []
    if current:
        groups.append(current)

    events = []
    hop_s = track.hop_length / track.sample_rate
    for frames in groups:
        frames = [i for i in frames if voiced[i]]
        if not frames:
            continue
        start = max(0.0, frames[0] * hop_s + offset_s)
        end = min(start + (frames[-1] - frames[0] + 1) * hop_s, offset_s + len(track.midi) * hop_s)
        if (end - start) * 1000 < MIN_NOTE_MS:
            continue
        pitch = int(round(float(np.median(midi[frames]))))
        if pitch < 36 or pitch > 96:
            continue
        event = {"id": len(events), **note_fields(pitch), "start_s": round(start, 4), "end_s": round(end, 4),
                 "duration_s": round(end - start, 4), "confidence": round(float(np.mean(track.probability[frames])), 3)}
        split_onset = any(frames[0] <= onset < frames[-1] for onset in onset_frames)
        if events and events[-1]["midi"] == pitch and start - events[-1]["end_s"] < 0.05 and not split_onset and frames[0] not in onset_frames:
            events[-1]["end_s"] = event["end_s"]
            events[-1]["duration_s"] = round(events[-1]["end_s"] - events[-1]["start_s"], 4)
            events[-1]["confidence"] = round((events[-1]["confidence"] + event["confidence"]) / 2, 3)
        else:
            events.append(event)
    for idx, event in enumerate(events):
        event["id"] = idx
    return events
