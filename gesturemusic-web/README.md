# GestureMusic · Parts 1 and 2

Browser-based Kodály / Curwen solfège learning prototype. The webcam, hand features, and personal sample set stay in the browser. Part 2 can import `src/data/noteSignMap.js`, `src/lib/features.js`, and `src/lib/knnClassifier.js` without UI dependencies.

Part 2 adds an **Analyze** page for uploading a single melodic audio line. Start the FastAPI service using the instructions in [`../backend/README.md`](../backend/README.md), then use Analyze. The frontend sends audio to `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`); analysis is temporary and the backend returns note events only. Run frontend unit tests with `pnpm test --run`.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local Vite URL in a current Chromium browser and allow camera access. Tone audio is enabled by the first Play note action or camera-start button. The hand model is stored at `public/models/hand_landmarker.task`; the Vite build copies the installed MediaPipe WASM runtime into `public/models/wasm`, so runtime inference uses local assets after installation.

## Live site

The `main` branch automatically builds and publishes this app to [GitHub Pages](https://kushalyn2006.github.io/SignSic/). The workflow runs when files under `gesturemusic-web/` change. If the first deployment does not start, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## Sign convention

Version 1 uses fixed-do for one octave: C4 = Do, D4 = Re, through B4 = Ti. Kodály teaching normally uses movable-do; this fixed-do mapping is a deliberate learning simplification. Hand height is not used for recognition yet.

The camera variants are designed for a front-facing webcam: keep the whole hand and wrist visible about 40–70 cm from the camera, around chest or shoulder height, and perform the pose slowly. Do is a loose fist with the back toward the camera. Re is a flat joined-finger hand angled about 45 degrees upward in the image. Mi is the same flat shape held level. Fa is a loose fist with thumb down. Sol is upright with the palm facing the signer. La is relaxed and curved with fingertips drooping. Ti points the index finger up while the others curl. These descriptions are the recording convention; confirm them against the teaching reference used in the course.

## Calibration and dataset

Recognition works on a first visit using `public/data/default_samples.json`; calibration is optional. The Calibrate page offers three training modes: **Use default samples (recommended)**, **Use my samples**, and **Use both**. The selection is stored under `gm.trainingMode`. In Both mode each personal sample has twice the vote weight of a default sample. Default rows are bundled and read-only; deleting or clearing affects only personal IndexedDB data. If the default file cannot be loaded, existing personal data is selected automatically.

The shipped version 1 dataset has 1,264 rows (632 recorded and 632 augmented), 72 features per row, and the seven labels C, D, E, F, G, A, and B. Optional `featureVersion`, `featureLength`, `createdAt`, and `notes` metadata are supported; files without feature metadata are interpreted as feature version 1 with 72 features. Invalid rows are skipped and counted, while a dataset with most rows invalid is refused. New personal recordings retain rounded raw 21-point world landmarks and handedness, and features are rebuilt from those landmarks when loaded. Existing features-only exports remain supported. If augmentation is omitted from a prepared default file, the app regenerates deterministic variants at load.

The attached source is archived unchanged at `data-source/gesturemusic-samples.json`. Prepare a compact copy without changing that archive:

```powershell
pnpm run prepare:data -- --round 4
pnpm run prepare:data -- --round 4 --drop-augmented
pnpm run prepare:data -- --drop label=C,handedness=Left
```

The prepare script defaults to reading `data-source/gesturemusic-samples.json` and writing `public/data/default_samples.json`; it refuses to overwrite its input. Audit the shipped file with `pnpm audit:data` (equivalent to `npm run audit:data`). The report includes label, hand, and source counts, per-class centroids and spreads, non-finite feature values, duplicate rows, and warnings for unusual hand clusters, high class spread, or fewer than 60 recorded rows.

**Known dataset issue:** sign C has 60 recorded Left-hand rows and 27 recorded Right-hand rows; every other sign is Right-hand only. The audit measures the C Left/Right centroid separation at about 3.49 in raw Euclidean feature space (RMS distance 0.411; typical within-hand RMS spread is about 0.13). The left-hand cluster may not be in the same mirrored frame as the right-hand cluster. Re-record C with the right hand, or fix handedness mirroring and re-record. The shipped rows are preserved as received; the audit never deletes or edits them.

Each **Record samples** press gets one take ID; its recorded and augmented rows stay together in evaluation. Calibrate evaluates by holding out complete takes. Legacy rows without a take ID are grouped by contiguous label runs and the page labels their results **Legacy data: scores may be optimistic**. If there is only one independent take for a sign, its rows are not used as held-out test data. The score and confusion matrix show which training mode was evaluated. Default recognition thresholds are recommended from leave-one-group-out nearest-neighbor measurements; set numeric `MIN_CONFIDENCE` or `MAX_DISTANCE` in `src/config.js` to override them. The score estimates performance on held-out takes, not a guarantee for new lighting or camera conditions.

### Contribute a profile

To improve the default dataset, record each sign at three camera distances and in two lighting conditions, ideally with three to five different people. Keep each Record press as a separate take and tag rows from the same person with a stable `profile` ID. Re-record both hands consistently when testing handedness mirroring, and run `pnpm audit:data` before shipping a prepared dataset.

## Recognition settings

`src/config.js` holds `KNN_K`, `MIN_CONFIDENCE`, `MAX_DISTANCE`, `CONFIRM_FRAMES`, and `HOLD_MS`. k-NN uses distance-weighted Euclidean votes over a 72-value vector: wrist-relative and scale-normalized 3D landmarks, palm normal, five curl ratios, and image-plane hand tilt. It does not rotate-normalize because orientation distinguishes several signs. Low-confidence or too-distant input is rejected as unknown.

The handedness self-check is in Calibrate. Raise the right hand and compare the displayed label; turn **Flip label** on if the label is inverted. The choice is kept in local browser storage. Calibrate can also save a cropped photo of your sign in this browser and optionally switch that card to a dot-only skeleton averaged from recent landmarks.

## Add a sign

Add its note/sign entry to `src/data/noteSignMap.js`, then add its reference image to `public/signs/` and use the matching lowercase solfège filename. The classifier and Calibrate choices derive their note labels from the shared map. Keep camera instructions distinct and record samples for the new label before enabling recognition for it.

## Hand-sign image credit

Traditional sign images are 600 px wide copies from Freya Jarman's Wikimedia Commons set. Each file is dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Credit is included here and in the app footer as a courtesy.

- [Do](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_do.jpg)
- [Re](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_re.jpg)
- [Mi](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_mi.jpg)
- [Fa](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_fa.jpg)
- [Sol](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_sol.jpg)
- [La](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_la.jpg)
- [Ti](https://commons.wikimedia.org/wiki/File:Solfege_hand_sign_ti.jpg)
