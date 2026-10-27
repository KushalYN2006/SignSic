from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path

from gesture_mapper import instrument_details, note_name_to_midi, to_midi_velocity
from soundfont_engine import SoundFontEngine
from synth_engine import SynthEngine


class SequenceRecorder:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def add(self, event: dict) -> None:
        self.events.append(dict(event))

    def delete_last(self) -> dict | None:
        if not self.events:
            return None
        return self.events.pop()

    def clear(self) -> None:
        self.events.clear()

    def save(self, folder: str | Path = "sequences") -> Path:
        out_dir = Path(folder)
        out_dir.mkdir(parents=True, exist_ok=True)
        filename = datetime.now().strftime("hand_sign_sequence_%Y%m%d_%H%M%S.json")
        path = out_dir / filename
        path.write_text(json.dumps(self.events, indent=2), encoding="utf-8")
        return path

    def load(self, path: str | Path) -> list[dict]:
        self.events = json.loads(Path(path).read_text(encoding="utf-8"))
        self.events = [self._with_playback_fields(event) for event in self.events]
        return self.events

    def replay(self, synth: SynthEngine, soundfont: SoundFontEngine | None = None) -> None:
        previous_timestamp = 0.0
        for index, event in enumerate(self.events):
            event = self._with_playback_fields(event)
            timestamp = float(event.get("timestamp", previous_timestamp))
            time.sleep(max(0.0, timestamp - previous_timestamp))
            if event.get("engine") == "soundfont" and soundfont:
                soundfont.play_note(
                    channel=soundfont.channel_for_program(int(event["program"])),
                    midi_note=int(event["midi_note"]),
                    velocity=int(event.get("velocity", 80)),
                    duration=float(event.get("duration", 0.3)),
                    program=int(event["program"]),
                )
            else:
                synth.trigger(
                    event["instrument"],
                    float(event["frequency"]),
                    float(event.get("duration", 0.3)),
                    float(event.get("volume", 0.4)),
                )
            previous_timestamp = timestamp

    @staticmethod
    def _with_playback_fields(event: dict) -> dict:
        upgraded = dict(event)
        engine, instrument, program = instrument_details(upgraded.get("instrument", "off"))
        upgraded.setdefault("engine", engine)
        upgraded.setdefault("instrument", instrument)
        upgraded.setdefault("program", program)
        upgraded.setdefault("midi_note", note_name_to_midi(upgraded["note"]))
        upgraded.setdefault("velocity", to_midi_velocity(float(upgraded.get("volume", 0.4))))
        return upgraded
