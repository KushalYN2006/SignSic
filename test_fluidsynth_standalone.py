"""Standalone FluidSynth diagnostic for the real-instrument SoundFont path."""

import time
from pathlib import Path

from config import SOUNDFONT_PATH


PROGRAM_PIANO = 0
PROGRAM_VIOLIN = 40

NOTE_C4 = 60
NOTE_E4 = 64
NOTE_G4 = 67


def main() -> int:
    soundfont_path = Path(SOUNDFONT_PATH)
    if not soundfont_path.exists():
        print(f"ERROR: SoundFont file not found: {soundfont_path}")
        print("Put FluidR3_GM.sf2 at this exact path, then run the test again:")
        print(soundfont_path.resolve())
        return 1

    try:
        import fluidsynth
    except ImportError:
        print("ERROR: pyfluidsynth is installed, but libfluidsynth.dll was not found.")
        print("Install FluidSynth for Windows, then add its bin folder to PATH.")
        print("After that, open a new terminal and run this test again.")
        return 1

    fs = fluidsynth.Synth()
    fs.start()

    sfid = fs.sfload(str(soundfont_path))
    if sfid == -1:
        print(f"ERROR: Failed to load SoundFont at '{SOUNDFONT_PATH}'.")
        print("Check that the file exists and is a valid General MIDI .sf2 file.")
        fs.delete()
        return 1

    print(f"SoundFont loaded successfully (sfid={sfid}).")

    print("Playing PIANO (C4-E4-G4 chord)...")
    channel = 0
    fs.program_select(channel, sfid, 0, PROGRAM_PIANO)
    for note in [NOTE_C4, NOTE_E4, NOTE_G4]:
        fs.noteon(channel, note, 100)
    time.sleep(2)
    for note in [NOTE_C4, NOTE_E4, NOTE_G4]:
        fs.noteoff(channel, note)

    time.sleep(1)

    print("Playing VIOLIN (single sustained E4)...")
    fs.program_select(channel, sfid, 0, PROGRAM_VIOLIN)
    fs.noteon(channel, NOTE_E4, 100)
    time.sleep(3)
    fs.noteoff(channel, NOTE_E4)

    time.sleep(1)

    print("Playing VIOLIN scale (C4 to G4)...")
    for note in [60, 62, 64, 65, 67]:
        fs.noteon(channel, note, 100)
        time.sleep(0.4)
        fs.noteoff(channel, note)

    time.sleep(1)
    fs.delete()
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
