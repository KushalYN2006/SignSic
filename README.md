# Hand Sign to Musical Note Generator

Python desktop app that turns webcam hand gestures into musical notes. It is
inspired by `manipta/Musicment`, but rebuilt as a modular PyQt application with
a live camera canvas, dot-only hand landmark overlay, per-hand instrument selection,
note-event logging, and JSON sequence save/load.

## Features

- Tracks up to two hands with MediaPipe Hands.
- Maps thumb-to-index distance to a C4-C6 major scale.
- Uses gesture motion speed for note volume.
- Debounces note events so hand jitter does not spam the synth.
- Supports `off`, `synth`, `fm`, `am`, `duo`, Piano, Violin, Guitar, Flute,
  and Trumpet options per hand.
- Draws dot-only hand landmarks on raw video or on a black canvas.
- Records note events and saves/loads them as JSON.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The app expects the MediaPipe hand model at
`models/hand_landmarker.task`. It is included in this project folder.

## Optional SoundFont Setup

The synth engines (`synth`, `fm`, `am`, and `duo`) work with no extra setup.
The real instrument options use FluidSynth, so they need one additional
system library and a SoundFont file.

On Windows, install FluidSynth from a trusted Windows build or package manager
such as Chocolatey:

```powershell
choco install fluidsynth
```

Then download a General MIDI `.sf2` file such as `FluidR3_GM.sf2` and place it
at:

```text
assets/soundfonts/FluidR3_GM.sf2
```

If the SoundFont file or FluidSynth system library is missing, the app still
runs and the synth engines still work. Real instrument selections will show a
message in the note log until setup is complete.

To test FluidSynth outside the app, run a standalone script that loads the same
`.sf2` and plays Piano and Violin notes. If that standalone test sounds correct
but the app does not, the problem is app routing. If the standalone test also
sounds wrong, use a different higher-quality SoundFont.

## Run

```powershell
.\.venv\Scripts\python.exe main.py
```

Press **Play** to start camera tracking and audio. Hold your hand in front of
the camera, then move thumb and index finger closer/farther apart to change the
note. Use the instrument radio buttons to choose the synth or real instrument
sound for each hand.

Each visible hand controls one live note at a time. When a hand leaves the
camera view, that hand's note is stopped immediately. When the thumb-index
distance moves into a different note range, the current note is replaced on the
next camera frame.

Sound velocity is controlled by vertical drag. Move either hand upward in the
camera view to increase velocity, and move it downward to reduce velocity.

## Project Structure

```text
main.py
config.py
hand_tracker.py
gesture_mapper.py
synth_engine.py
soundfont_engine.py
sequence_recorder.py
assets/
  soundfonts/
ui/
  __init__.py
  main_window.py
  video_widget.py
  styles.py
```

## Implementation Notes

`gesture_mapper.py` contains the Musicment-inspired distance-to-note mapping.
It computes the Euclidean distance between MediaPipe landmark 4, the thumb tip,
and landmark 8, the index fingertip. The distance is normalized using
calibration constants in `config.py`, quantized into a note bucket, and emitted
only when the bucket changes after a debounce interval.

`synth_engine.py` generates audio locally with NumPy and plays it through
`sounddevice`. Each note receives a short attack/release envelope to avoid
clicks. FM, AM, and duo synthesis are documented in inline comments for viva or
project-report reference.
