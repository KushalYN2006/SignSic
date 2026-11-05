NATURAL_PITCH_CLASSES = {0, 2, 4, 5, 7, 9, 11}


def suggest_transpose(midi_values: list[int]) -> int:
    """Choose the -6..+5 shift placing the most notes on C major; ties favor the smallest shift."""
    if not midi_values:
        return 0
    shifts = range(-6, 6)
    return max(shifts, key=lambda shift: (sum((m + shift) % 12 in NATURAL_PITCH_CLASSES for m in midi_values), -abs(shift), -shift))


def note_fields(midi: int) -> dict:
    names = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
    pitch_class = names[midi % 12]
    octave = midi // 12 - 1
    return {"note": f"{pitch_class}{octave}", "pitch_class": pitch_class, "octave": octave,
            "midi": midi, "is_natural": len(pitch_class) == 1}


def transpose_notes(notes: list[dict], shift: int) -> list[dict]:
    shifted = []
    for note in notes:
        row = dict(note)
        row.update(note_fields(row["midi"] + shift))
        shifted.append(row)
    return shifted
