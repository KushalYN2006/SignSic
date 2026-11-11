# GestureMusic Project Work Report

**Project:** GestureMusic — hand signs, solfège learning, and audio analysis

**Repository:** [KushalYN2006/SignSic](https://github.com/KushalYN2006/SignSic)

**Report date:** 11 November 2026

## 1. Project overview

GestureMusic explores a hands-on way to connect hand movement, musical notes, and visual learning. The repository contains a browser based learning application and a separate Python desktop prototype inspired by Musicment. The browser app also includes Part 2: uploading a short melodic recording, extracting note events, and following those notes with the corresponding solfège signs.

The current browser learning convention uses fixed Do: the natural pitch classes C, D, E, F, G, A, and B correspond to Do, Re, Mi, Fa, Sol, La, and Ti. The learning pages provide traditional sign references, webcam recognition, practice playback, calibration, and a note sequence interface. The audio analysis feature is a monophonic prototype; it is not a chord transcription or polyphonic source separator.

## 2. Repository structure

```text
.
├── .github/workflows/
│   ├── deploy-pages.yml        # Build and publish the web app
│   └── backend-ci.yml          # Backend checks
├── backend/                    # FastAPI audio analysis service
├── gesturemusic-web/           # React + Vite browser application
│   ├── data-source/             # Untouched source training dataset
│   ├── public/data/              # Bundled read-only recognition dataset
│   ├── public/models/            # Hand landmark model and local runtime assets
│   ├── public/signs/             # Traditional sign reference photos
│   ├── scripts/                  # Dataset audit and preparation tools
│   └── src/                      # Pages, hooks, recognition, and playback
├── hand/                         # Python desktop hand tracking
├── ui/                           # PyQt desktop application interface
├── main.py                       # Desktop application entry point
└── PROJECT_WORK_REPORT.md        # This report
```

## 3. Browser application

The browser app is implemented with React 18, Vite, React Router, Tone.js, and MediaPipe Tasks Vision. The camera hand model runs locally in the browser. Gesture feature extraction and classification are also performed client side; camera frames and personal calibration data are not uploaded to the audio analysis API.

### Recognition pipeline

1. The browser fetches `public/data/default_samples.json` at startup before enabling recognition.
2. MediaPipe returns hand landmarks. The app converts the landmarks into a 72-value feature vector containing wrist-relative, scale-normalized 3D points, palm orientation, finger curl ratios, and hand tilt.
3. A distance-weighted k-nearest-neighbor classifier selects one of the seven note labels. Confidence and distance limits reject uncertain predictions.
4. Practice and Learn display the active recognition source, current sign, and an optional prompt to calibrate if recognition remains uncertain.
5. Note playback follows the detected note; the playback hook also resets audio state when a new audio source is selected so another analysis can be played without reloading the page.

The feature extractor includes handedness normalization and a mirroring equivalence check. The classifier has no added machine-learning dependency; the shipped dataset size is small enough for direct k-NN distance evaluation.

### Training data modes

The Calibrate page offers three sources:

| Mode | Classifier data |
|---|---|
| Default | Bundled samples; this is the first-visit default |
| Mine | The current browser user's recordings |
| Both | Bundled plus personal samples; personal votes count twice |

The selection persists as `gm.trainingMode`. The bundled data is read-only: clearing or deleting personal recordings does not change it. Users can capture personal samples by take, inspect recognition, evaluate on held-out takes, and capture a reference camera image. Evaluation uses whole takes where available and flags legacy estimates that may be optimistic.

The bundled version 1 dataset has 1,264 rows, 72 features per row, and labels C through B. The original attached dataset is preserved at `gesturemusic-web/data-source/gesturemusic-samples.json`; the app copy is at `gesturemusic-web/public/data/default_samples.json`. The audit and preparation scripts are `pnpm audit:data` and `pnpm prepare:data`.

**Dataset caveat:** C contains 60 recorded Left-hand rows and 27 recorded Right-hand rows; the other signs are Right-hand only. The C hand clusters are separated by about 3.49 in raw Euclidean feature space (about 0.411 RMS), much larger than typical within-hand spread. This may indicate that the left-hand C examples use a different mirrored frame. The audit reports the issue but does not modify rows. A clean improvement is to record C with the right hand or correct mirroring and then re-record consistently.

### Reference signs and visual design

The Learn and Reference cards show traditional sign photographs and separate camera-specific guidance. The photos are 600 px wide copies from Freya Jarman's Wikimedia Commons set, dedicated under CC0 1.0; courtesy credit appears in the app and README. User-captured camera references are local to the browser. A dot-skeleton view can be used as an alternate calibration reference.

## 4. Audio analysis service

The FastAPI backend accepts an audio file at `POST /api/analyze`. It validates file type and size, decodes and resamples audio to mono 22,050 Hz, estimates tuning, runs the enabled `pyin` pitch tracker, segments stable pitches into note events, and optionally transposes the result. The response contains note events, timing, a summary, tuning and quality metadata, and warnings. Temporary uploads are removed after processing. `GET /api/health` reports service status.

The current service targets a single melodic line and supports WAV, MP3, M4A, OGG, and FLAC (FFmpeg is needed for formats requiring external decoding). Synthetic test clips have been evaluated; their measured macro F1 is 0.894 across seven clips. These generated signals are useful for regression checks but do not establish equivalent accuracy on real instruments.

The browser defaults to `http://127.0.0.1:8000`; configure `VITE_API_BASE_URL` for a hosted backend. The API has configurable CORS origins via `GESTUREMUSIC_CORS_ORIGINS`. The current change set places CORS around the full ASGI application so error responses also carry CORS headers, and returns a clear unavailable-engine response when an analysis dependency cannot load.

**Current local environment limitation:** on the development Windows installation, Numba's compiled `_dispatcher` module is blocked by the machine's Application Control policy. The browser preflight/CORS behavior was confirmed, but a successful real upload analysis has not been verified in that environment; analysis may time out while the pitch engine is unavailable. This is an environment/runtime dependency issue, not evidence that the GitHub Pages frontend is deployed with a working public backend. Use an approved Python environment where Numba loads, then verify `/api/analyze`; a Pages deployment also needs a separately hosted API URL and matching CORS origin.

## 5. Python desktop prototype

The original Python desktop application is a modular PyQt webcam music prototype. MediaPipe detects up to two hands. Thumb-to-index distance selects notes, vertical hand movement controls velocity, and disappearance of a hand stops its note. It includes per-hand instrument selection, synthesized and FluidSynth-backed sounds, a dot landmark display, event logging, and sequence save/load. Real instrument playback requires the FluidSynth system library and a General MIDI SoundFont; the built-in synth modes do not.

## 6. GitHub Pages and automation

The Pages workflow installs the existing pnpm dependencies from `gesturemusic-web/pnpm-lock.yaml`, runs the frontend tests, builds the production site, uploads `gesturemusic-web/dist`, and deploys through the Pages artifact actions. Vite uses `/SignSic/` as the production base path and emits a `404.html` fallback for client-side routes. Workflow permissions include repository content read, Pages write, and OIDC token write. The backend CI workflow runs under Python 3.12, installs FFmpeg and backend requirements, generates sample audio, and runs pytest.

GitHub Pages serves the frontend only. Audio upload analysis requires a backend that is reachable from the user's browser; the local loopback default is suitable only when the frontend and backend are running on the same user's machine.

## 7. Development commands

### Frontend

From `gesturemusic-web/`:

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm test --run
pnpm build
pnpm audit:data
```

If pnpm is missing on Windows, install/enable it through the supported Node.js Corepack setup, then reopen PowerShell. Keep `pnpm-lock.yaml` as the dependency lockfile.

### Backend

From the repository root, install dependencies, then start the API:

```powershell
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Use a second terminal for the frontend. Backend checks can be run from `backend/` with `..\.venv\Scripts\python.exe -m pytest -q`.

### Dataset preparation

Run dataset preparation from `gesturemusic-web/`. The tool reads the archived original and writes the public app dataset; it refuses to overwrite its input.

```powershell
pnpm run prepare:data -- --round 4
pnpm run prepare:data -- --round 4 --drop-augmented
pnpm run prepare:data -- --drop label=C,handedness=Left
pnpm audit:data
```

Always audit candidate data before shipping it. Keep the untouched source copy for provenance and re-audit.

## 8. Current status and follow-up

- Browser recognition can start from the bundled dataset without calibration; personal and combined modes remain available.
- The default dataset is archived and audited, with the C handedness cluster caveat documented.
- Learn, Practice, Calibrate, reference photos, local user capture, note playback, and audio-analysis UI are included.
- GitHub Pages is configured to publish the web app under `/SignSic/`; it does not host the FastAPI backend.
- The repeated-analysis playback lifecycle fix is included so the next analyzed song can play without a full page refresh.
- Backend CORS handling and unavailable-engine diagnostics are improved. Confirm analysis in a Python environment permitted to load Numba's compiled modules.
- For a public end-to-end deployment, deploy the backend separately, configure `VITE_API_BASE_URL` to its HTTPS endpoint, allow the GitHub Pages origin in backend CORS, and test an actual supported audio upload.

## 9. References

- Repository: [KushalYN2006/SignSic](https://github.com/KushalYN2006/SignSic)
- Live frontend: [kushalyn2006.github.io/SignSic](https://kushalyn2006.github.io/SignSic/)
- Frontend and dataset details: [`gesturemusic-web/README.md`](gesturemusic-web/README.md)
- Backend setup and measured synthetic evaluation: [`backend/README.md`](backend/README.md)
