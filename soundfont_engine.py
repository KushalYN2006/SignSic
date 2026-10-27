from __future__ import annotations

from pathlib import Path
from threading import Lock, Timer

from config import SOUNDFONT_PATH, SOUNDFONT_PROGRAM_CHANNELS


class SoundFontEngine:
    def __init__(self, soundfont_path: str = SOUNDFONT_PATH) -> None:
        self.soundfont_path = Path(soundfont_path)
        self._fs = None
        self._sfid: int | None = None
        self._selected_programs: dict[int, int] = {}
        self._active_notes: dict[str, tuple[int, int]] = {}
        self._lock = Lock()
        self.available = False
        self.error: str | None = None

    def start(self) -> bool:
        if self.available:
            return True
        if not self.soundfont_path.exists():
            self.error = f"Missing SoundFont: {self.soundfont_path}"
            return False
        try:
            import fluidsynth
        except ImportError:
            self.error = (
                "Missing FluidSynth native library. Install FluidSynth for Windows "
                "and add the folder containing libfluidsynth.dll to PATH."
            )
            self._fs = None
            self._sfid = None
            self.available = False
            return False

        try:
            self._fs = fluidsynth.Synth()
            self._fs.start()
            self._sfid = self._fs.sfload(str(self.soundfont_path))
            for program, channel in SOUNDFONT_PROGRAM_CHANNELS.items():
                self._fs.program_select(channel, self._sfid, 0, program)
                self._selected_programs[channel] = program
            self.available = True
            self.error = None
            return True
        except Exception as exc:
            self._fs = None
            self._sfid = None
            self.available = False
            self.error = str(exc)
            return False

    def stop(self) -> None:
        if self._fs:
            self._fs.delete()
        self._fs = None
        self._sfid = None
        self._selected_programs.clear()
        self._active_notes.clear()
        self.available = False

    def play_note(
        self, channel: int, midi_note: int, velocity: int, duration: float, program: int
    ) -> bool:
        if not self.start() or not self._fs or self._sfid is None:
            return False
        if self._selected_programs.get(channel) != program:
            self._fs.program_select(channel, self._sfid, 0, program)
            self._selected_programs[channel] = program
        self._fs.noteon(channel, midi_note, velocity)
        timer = Timer(duration, self._noteoff, args=(channel, midi_note))
        timer.daemon = True
        timer.start()
        return True

    def play_live(
        self, key: str, midi_note: int, velocity: int, program: int
    ) -> bool:
        if not self.start() or not self._fs or self._sfid is None:
            return False
        channel = self.channel_for_program(program)
        with self._lock:
            previous = self._active_notes.get(key)
            if previous == (channel, midi_note):
                self._fs.cc(channel, 7, velocity)
                return True
            if previous:
                self._fs.noteoff(previous[0], previous[1])
            if self._selected_programs.get(channel) != program:
                self._fs.program_select(channel, self._sfid, 0, program)
                self._selected_programs[channel] = program
            self._fs.cc(channel, 7, velocity)
            self._fs.noteon(channel, midi_note, velocity)
            self._active_notes[key] = (channel, midi_note)
        return True

    def stop_live(self, key: str) -> None:
        if not self._fs:
            return
        with self._lock:
            previous = self._active_notes.pop(key, None)
            if previous:
                self._fs.noteoff(previous[0], previous[1])

    @staticmethod
    def channel_for_program(program: int) -> int:
        return SOUNDFONT_PROGRAM_CHANNELS.get(program, 0)

    def _noteoff(self, channel: int, midi_note: int) -> None:
        if self._fs:
            self._fs.noteoff(channel, midi_note)
