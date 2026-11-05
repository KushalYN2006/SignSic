# GestureMusic Part 2: Audio to hand signs

The Analyze page accepts a single melodic line. The browser sends it to a local FastAPI service, which temporarily decodes and analyzes it, then returns note events. The browser maps natural note letters to the shared `gesturemusic-web/src/data/noteSignMap.js` mapping and synchronizes the sign card and timeline to the original recording. Audio is removed from the server temporary directory after the request.

## Run locally

Install Python 3.12+ and FFmpeg (needed for MP3/M4A decoding), then from the repository root:

```powershell
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

In another terminal, run the existing React app:

```powershell
Set-Location gesturemusic-web
pnpm install --frozen-lockfile
pnpm dev
```

Set `VITE_API_BASE_URL` for a hosted API. The default is `http://127.0.0.1:8000`. Set `GESTUREMUSIC_CORS_ORIGINS` to a comma-separated list of allowed browser origins. The interactive API docs are at `http://127.0.0.1:8000/docs`.

## API

- `GET /api/health` reports status, version and available engines.
- `POST /api/analyze` accepts multipart `file`, `engine=pyin`, `transpose` and `auto_transpose` fields. Formats: WAV, MP3, M4A, OGG and FLAC. Limits: 20 MB and 60 seconds.
- Errors use `{ "error": { "code": "...", "message": "..." } }` and include `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `AUDIO_TOO_LONG`, `AUDIO_UNREADABLE`, `NO_NOTES_FOUND`, `ANALYSIS_TIMEOUT`.

## Pipeline

Inputs are downmixed/resampled to mono float32 at 22,050 Hz, trimmed with the original time offset retained, and peak-normalized. `librosa.estimate_tuning` estimates tuning; `librosa.pyin` tracks C2–C7 pitch at 2,048-sample frames and 512-sample hops. Voiced pitches receive median filtering and are segmented into stable note plateaus; note events shorter than 80 ms are dropped. A deterministic semitone search from −6 to +5 finds the shift that places the most notes in C major; manual or automatic transposition updates MIDI values and note names. The browser alone owns the pitch-to-sign mapping. Analysis runs in a worker thread with a 45-second timeout.

Tunables are in `app/config.py` and environment variables `GESTUREMUSIC_FRAME_LENGTH`, `GESTUREMUSIC_HOP_LENGTH`, `GESTUREMUSIC_ANALYSIS_TIMEOUT`, and `GESTUREMUSIC_CORS_ORIGINS`.

## Samples and evaluation

Generate copyright-free additive-tone sample clips and JSON ground truth:

```powershell
..\.venv\Scripts\python.exe scripts\make_samples.py
..\.venv\Scripts\python.exe scripts\evaluate.py
```

`evaluation.json` and the printed table contain measured note precision, recall and F1 for the generated files. Run `..\.venv\Scripts\python.exe -m pytest` for the backend API and algorithm checks.

Current measured results (`python scripts/evaluate.py`, librosa 1.0.0 pyin, mir_eval with 50 ms onset tolerance, offsets ignored and 50-cent pitch tolerance; macro-average across the seven generated clips):

| Clip | Precision | Recall | F1 |
|---|---:|---:|---:|
| Accidentals | 0.778 | 1.000 | 0.875 |
| Ode to Joy | 0.882 | 1.000 | 0.938 |
| Repeated notes | 0.667 | 1.000 | 0.800 |
| Rests | 0.667 | 1.000 | 0.800 |
| C major scale | 0.938 | 1.000 | 0.968 |
| Sharp tuning (+20 cents) | 0.833 | 1.000 | 0.909 |
| Twinkle Twinkle | 0.933 | 1.000 | 0.966 |
| **Macro average** | **0.814** | **1.000** | **0.894** |

These are synthetic additive-tone results. Repeated-note and rest clips expose over-segmentation on short synthetic attacks. They are not representative of real-instrument performance.

## Limits

This is an experimental monophonic prototype; chords and multiple instruments can confuse pitch tracking. Its seven gesture labels cover natural pitch classes only, with octave shown separately. Accidentals can be transposed but have no hand sign in v1. The optional Basic Pitch engine, follow-along scoring, and detailed polyphony separation are not enabled. Results depend on recording quality and instrument timbre; synthetic sample metrics do not predict accuracy on real performances.
