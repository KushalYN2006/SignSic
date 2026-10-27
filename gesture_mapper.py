from __future__ import annotations

from dataclasses import dataclass, field
from time import monotonic

import numpy as np

from config import (
    DEFAULT_NOTE_DURATION,
    HAND_VOLUME_DEFAULT,
    HAND_VOLUME_DRAG_SENSITIVITY,
    HAND_VOLUME_MAX,
    HAND_VOLUME_MIN,
    MAX_PINCH_DISTANCE,
    MIN_PINCH_DISTANCE,
    SCALE_NOTES,
    SOUNDFONT_INSTRUMENTS,
    SYNTH_INSTRUMENTS,
)


FREQUENCIES = {
    "C4": 261.63,
    "D4": 293.66,
    "E4": 329.63,
    "F4": 349.23,
    "G4": 392.00,
    "A4": 440.00,
    "B4": 493.88,
    "C5": 523.25,
    "D5": 587.33,
    "E5": 659.25,
    "F5": 698.46,
    "G5": 783.99,
    "A5": 880.00,
    "B5": 987.77,
    "C6": 1046.50,
}


def note_name_to_midi(note: str) -> int:
    pitch_class = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    name = note[0].upper()
    octave = int(note[1:])
    return 12 * (octave + 1) + pitch_class[name]


def to_midi_velocity(volume: float) -> int:
    return int(np.clip(round(volume * 127), 1, 127))


def instrument_details(selection: str) -> tuple[str, str, int | None]:
    if selection in SOUNDFONT_INSTRUMENTS:
        return "soundfont", selection, SOUNDFONT_INSTRUMENTS[selection]
    if selection in SYNTH_INSTRUMENTS:
        return "synth", selection, None
    return "synth", "off", None


@dataclass
class HandGestureState:
    last_bucket: int | None = None
    last_normalized: float = 0.0
    last_event_time: float = 0.0
    last_center_y: float | None = None
    volume: float = HAND_VOLUME_DEFAULT
    last_seen_time: float = field(default_factory=monotonic)


class GestureMapper:
    def __init__(self) -> None:
        self.states = {"left": HandGestureState(), "right": HandGestureState()}
        self.recording_start = monotonic()

    def reset_clock(self) -> None:
        self.recording_start = monotonic()
        for state in self.states.values():
            state.last_bucket = None
            state.last_event_time = 0.0
            state.last_center_x = None
            state.volume = HAND_VOLUME_DEFAULT

    def reset_hand(self, hand: str) -> None:
        state = self.states.setdefault(hand, HandGestureState())
        state.last_bucket = None
        state.last_normalized = 0.0
        state.last_event_time = 0.0
        state.last_center_y = None
        state.volume = HAND_VOLUME_DEFAULT

    def update(
        self,
        hand: str,
        landmarks: list[tuple[float, float, float]],
        frame_size: tuple[int, int],
        instrument: str,
    ) -> dict | None:
        state = self.states.setdefault(hand, HandGestureState())
        now = monotonic()
        state.last_seen_time = now

        width, height = frame_size
        thumb = np.array([landmarks[4][0] * width, landmarks[4][1] * height])
        index = np.array([landmarks[8][0] * width, landmarks[8][1] * height])
        distance = float(np.linalg.norm(thumb - index))
        center_y = float(np.mean([point[1] for point in landmarks]))

        normalized = self._normalize(distance)
        bucket = self._bucket_for(normalized)

        # Volume is controlled by vertical dragging. Moving either hand upward
        # raises velocity; moving it downward lowers velocity.
        if state.last_center_y is not None:
            delta_y = center_y - state.last_center_y
            state.volume -= delta_y * HAND_VOLUME_DRAG_SENSITIVITY
            state.volume = float(np.clip(state.volume, HAND_VOLUME_MIN, HAND_VOLUME_MAX))
        state.last_center_y = center_y
        volume = state.volume
        duration = (
            max(DEFAULT_NOTE_DURATION, now - state.last_event_time)
            if state.last_event_time
            else DEFAULT_NOTE_DURATION
        )

        bucket_changed = state.last_bucket is None or bucket != state.last_bucket
        state.last_normalized = normalized

        if bucket_changed:
            state.last_bucket = bucket
            state.last_event_time = now
        note = SCALE_NOTES[bucket]
        engine, instrument, program = instrument_details(instrument)
        midi_note = note_name_to_midi(note)
        velocity = to_midi_velocity(volume)
        return {
            "hand": hand,
            "instrument": instrument,
            "engine": engine,
            "program": program,
            "note": note,
            "midi_note": midi_note,
            "frequency": FREQUENCIES[note],
            "volume": round(volume, 3),
            "velocity": velocity,
            "duration": round(duration, 3),
            "timestamp": round(now - self.recording_start, 3),
            "note_changed": bucket_changed,
        }

    @staticmethod
    def _normalize(distance: float) -> float:
        span = MAX_PINCH_DISTANCE - MIN_PINCH_DISTANCE
        return float(np.clip((distance - MIN_PINCH_DISTANCE) / span, 0.0, 1.0))

    @staticmethod
    def _bucket_for(normalized: float) -> int:
        return min(len(SCALE_NOTES) - 1, int(normalized * len(SCALE_NOTES)))
