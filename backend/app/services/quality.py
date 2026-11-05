import numpy as np


def quality_warnings(voiced_ratio: float, notes: list[dict], probabilities: np.ndarray, clipped: bool = False) -> list[dict]:
    warnings = []
    if voiced_ratio < 0.5:
        warnings.append({"code": "LOW_VOICING", "message": "A lot of silence or noise was detected; try a cleaner, louder monophonic recording."})
    if len(notes) < 3:
        warnings.append({"code": "FEW_NOTES", "message": "Fewer than three notes were detected; the melody may be too quiet or short."})
    if len(notes) > 1:
        durations = np.diff([n["start_s"] for n in notes])
        if np.any(durations < 0.04) or (probabilities.size and float(np.var(1 - probabilities)) > 0.08):
            warnings.append({"code": "POLYPHONY_SUSPECTED", "message": "Rapid pitch changes or unstable voicing may indicate chords, noise, or multiple instruments."})
    coverage = sum(n["is_natural"] for n in notes) / max(1, len(notes))
    if coverage < 0.8:
        warnings.append({"code": "MANY_ACCIDENTALS", "message": "Many notes fall outside the seven natural-note signs. Try transposing the melody."})
    if clipped:
        warnings.append({"code": "CLIPPING_DETECTED", "message": "The recording may be clipped; a lower recording level may improve pitch detection."})
    return warnings
