from __future__ import annotations

from dataclasses import dataclass
from threading import Lock

import numpy as np
import sounddevice as sd

from config import (
    AM_RATE,
    ATTACK_SECONDS,
    DUO_DETUNE_CENTS,
    FM_MOD_INDEX,
    FM_MOD_RATIO,
    MAX_POLYPHONY,
    RELEASE_SECONDS,
    SAMPLE_RATE,
)


@dataclass
class Voice:
    samples: np.ndarray
    index: int = 0


@dataclass
class HeldVoice:
    instrument: str
    frequency: float
    volume: float
    phase: float = 0.0
    age: int = 0


class SynthEngine:
    def __init__(self) -> None:
        self._voices: list[Voice] = []
        self._held_voices: dict[str, HeldVoice] = {}
        self._lock = Lock()
        self._stream: sd.OutputStream | None = None

    def start(self) -> None:
        if self._stream:
            return
        self._stream = sd.OutputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            callback=self._callback,
            blocksize=0,
        )
        self._stream.start()

    def stop(self) -> None:
        if not self._stream:
            return
        self._stream.stop()
        self._stream.close()
        self._stream = None
        with self._lock:
            self._voices.clear()
            self._held_voices.clear()

    def trigger(self, instrument: str, frequency: float, duration: float, volume: float) -> None:
        if instrument == "off":
            return
        samples = render_note(instrument, frequency, duration, volume)
        with self._lock:
            self._voices.append(Voice(samples=samples))
            self._voices = self._voices[-MAX_POLYPHONY:]

    def play_live(self, key: str, instrument: str, frequency: float, volume: float) -> None:
        if instrument == "off":
            self.stop_live(key)
            return
        with self._lock:
            current = self._held_voices.get(key)
            if current and current.instrument == instrument and current.frequency == frequency:
                current.volume = volume
                return
            self._held_voices[key] = HeldVoice(instrument=instrument, frequency=frequency, volume=volume)

    def stop_live(self, key: str) -> None:
        with self._lock:
            self._held_voices.pop(key, None)

    def stop_all_live(self) -> None:
        with self._lock:
            self._held_voices.clear()

    def _callback(self, outdata, frames, _time_info, _status) -> None:
        mix = np.zeros(frames, dtype=np.float32)
        with self._lock:
            for voice in self._held_voices.values():
                mix += render_live_block(voice, frames)
            active: list[Voice] = []
            for voice in self._voices:
                end = min(voice.index + frames, len(voice.samples))
                chunk = voice.samples[voice.index:end]
                mix[: len(chunk)] += chunk
                voice.index = end
                if voice.index < len(voice.samples):
                    active.append(voice)
            self._voices = active
        outdata[:, 0] = np.clip(mix, -1.0, 1.0)


def render_live_block(voice: HeldVoice, frames: int) -> np.ndarray:
    t = (np.arange(frames, dtype=np.float32) + voice.phase) / SAMPLE_RATE
    amplitude = float(np.clip(voice.volume, 0.0, 1.0)) * 0.28
    if voice.instrument == "fm":
        modulator = np.sin(2 * np.pi * voice.frequency * FM_MOD_RATIO * t)
        wave = np.sin(2 * np.pi * voice.frequency * t + FM_MOD_INDEX * modulator)
    elif voice.instrument == "am":
        tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * AM_RATE * t)
        wave = np.sin(2 * np.pi * voice.frequency * t) * tremolo
    elif voice.instrument == "duo":
        ratio = 2 ** (DUO_DETUNE_CENTS / 1200)
        wave = 0.5 * (
            np.sin(2 * np.pi * voice.frequency / ratio * t)
            + np.sin(2 * np.pi * voice.frequency * ratio * t)
        )
    else:
        wave = np.sin(2 * np.pi * voice.frequency * t)

    voice.phase += frames
    voice.age += frames
    attack = max(1, int(ATTACK_SECONDS * SAMPLE_RATE))
    if voice.age < attack:
        wave *= voice.age / attack
    return (wave * amplitude).astype(np.float32)


def render_note(instrument: str, frequency: float, duration: float, volume: float) -> np.ndarray:
    sample_count = max(1, int(duration * SAMPLE_RATE))
    t = np.arange(sample_count, dtype=np.float32) / SAMPLE_RATE
    amplitude = float(np.clip(volume, 0.0, 1.0)) * 0.35

    if instrument == "fm":
        # FM bends the carrier phase with a second oscillator, adding bell-like
        # overtones while keeping the note's perceived pitch at the carrier.
        modulator = np.sin(2 * np.pi * frequency * FM_MOD_RATIO * t)
        wave = np.sin(2 * np.pi * frequency * t + FM_MOD_INDEX * modulator)
    elif instrument == "am":
        # AM multiplies the sine carrier by a slow LFO for a tremolo pulse.
        tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * AM_RATE * t)
        wave = np.sin(2 * np.pi * frequency * t) * tremolo
    elif instrument == "duo":
        # Duo mixes two slightly detuned sines for a wider chorused tone.
        ratio = 2 ** (DUO_DETUNE_CENTS / 1200)
        wave = 0.5 * (
            np.sin(2 * np.pi * frequency / ratio * t)
            + np.sin(2 * np.pi * frequency * ratio * t)
        )
    else:
        wave = np.sin(2 * np.pi * frequency * t)

    return (wave * _envelope(sample_count) * amplitude).astype(np.float32)


def _envelope(sample_count: int) -> np.ndarray:
    env = np.ones(sample_count, dtype=np.float32)
    attack = min(sample_count, int(ATTACK_SECONDS * SAMPLE_RATE))
    release = min(sample_count, int(RELEASE_SECONDS * SAMPLE_RATE))
    if attack > 0:
        env[:attack] = np.linspace(0.0, 1.0, attack, dtype=np.float32)
    if release > 0:
        env[-release:] *= np.linspace(1.0, 0.0, release, dtype=np.float32)
    return env
