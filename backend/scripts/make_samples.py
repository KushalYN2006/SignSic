"""Generate copyright-free synthetic monophonic demos and note truth JSON."""
import json
from pathlib import Path
import sys

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
FRONT_SAMPLES = ROOT.parent / "gesturemusic-web" / "public" / "samples"
RATE = 22050
MELODIES = {
    "scale": [60,62,64,65,67,69,71,72,71,69,67,65,64,62,60],
    "twinkle": [60,60,67,67,69,69,67,65,65,64,64,62,62,60],
    "ode": [64,64,65,67,67,65,64,62,60,60,62,64,64,62,62],
}


def synth_note(midi: int, duration: float, cents: float = 0) -> np.ndarray:
    count = int(duration * RATE)
    t = np.arange(count) / RATE
    frequency = 440 * 2 ** ((midi - 69 + cents / 100) / 12)
    envelope = np.minimum(1, t / .035) * np.minimum(1, (duration - t) / .05).clip(0)
    vibrato = 1 + .003 * np.sin(2 * np.pi * 5.2 * t)
    wave = (np.sin(2*np.pi*frequency*t*vibrato) + .25*np.sin(4*np.pi*frequency*t*vibrato)) * envelope
    return (wave * .55).astype(np.float32)


def make(name: str, notes: list[int], copy_frontend: bool = False, cents: float = 0) -> None:
    audio = np.concatenate([np.concatenate([np.zeros(int(.08*RATE),np.float32), synth_note(n,.36,cents)]) for n in notes])
    path = ROOT / "samples" / f"{name}.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path,audio,RATE)
    truth=[]; cursor=0
    for idx,note in enumerate(notes):
        start=cursor/RATE+.08; end=start+.36
        pitch="C C# D D# E F F# G G# A A# B".split()[note%12]
        truth.append({"id":idx,"note":f"{pitch}{note//12-1}","pitch_class":pitch,"octave":note//12-1,"midi":note,
                      "start_s":round(start,4),"end_s":round(end,4),"duration_s":.36,"confidence":1.0,"is_natural":"#" not in pitch})
        cursor += int(.44*RATE)
    path.with_suffix('.json').write_text(json.dumps(truth,indent=2),encoding='utf-8')
    if copy_frontend:
        FRONT_SAMPLES.mkdir(parents=True, exist_ok=True)
        (FRONT_SAMPLES/f"{name}.wav").write_bytes(path.read_bytes())


def main():
    for name,notes in MELODIES.items(): make(name,notes,True)
    make('repeated',[60,60,62,62,64,64])
    make('rests',[60,64,67,72])
    make('sharp_tuning',[60,62,64,67,69],cents=20)
    make('accidentals',[62,64,66,67,69,71,73])


if __name__ == '__main__': main()
