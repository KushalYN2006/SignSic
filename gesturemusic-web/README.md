# GestureMusic · Part 1

Browser-based Kodály / Curwen solfège learning prototype. The webcam, hand features, and personal sample set stay in the browser. Part 2 can import `src/data/noteSignMap.js`, `src/lib/features.js`, and `src/lib/knnClassifier.js` without UI dependencies.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local Vite URL in a current Chromium browser and allow camera access. Tone audio is enabled by the first Play note action or camera-start button. The hand model is stored at `public/models/hand_landmarker.task`; the Vite build copies the installed MediaPipe WASM runtime into `public/models/wasm`, so runtime inference uses local assets after installation.

## Sign convention

Version 1 uses fixed-do for one octave: C4 = Do, D4 = Re, through B4 = Ti. Kodály teaching normally uses movable-do; this fixed-do mapping is a deliberate learning simplification. Hand height is not used for recognition yet.

The camera variants are designed for a front-facing webcam: keep the whole hand and wrist visible about 40–70 cm from the camera, around chest or shoulder height, and perform the pose slowly. Do is a loose fist with the back toward the camera. Re is a flat joined-finger hand angled about 45 degrees upward in the image. Mi is the same flat shape level. Fa is a loose fist with thumb down. Sol turns the flat hand onto its edge. La is gently curved with fingertips drooping. Ti points the index finger up while the others curl. These descriptions are the recording convention; confirm them against the teaching reference used in the course.

## Calibration and dataset

Calibrate each sign under similar lighting and camera position. For a selected sign, press **Record samples** and vary hand distance, position, and small angles while keeping the pose recognizable. Each capture runs for about 10 seconds and targets 150 frames. Small scale, rotation (within ±8 degrees), and feature-noise augmentations are stored with their source sample. Personal data is saved in IndexedDB. Use **Export JSON** for a backup or **Import JSON** to load a dataset. The shipped `public/data/default_samples.json` is intentionally empty until real developer-recorded signs are added; the UI reports that recognition needs training data.

Calibrate includes grouped 5-fold cross-validation and a confusion matrix. Augmented variants from one captured pose remain in the same fold to reduce validation leakage. Treat the score as an estimate for the collected samples, not a promise for unseen lighting or camera conditions. The likely confusions to review are Re/Mi, Mi/La, and Mi/Sol.

## Recognition settings

`src/config.js` holds `KNN_K`, `MIN_CONFIDENCE`, `MAX_DISTANCE`, `CONFIRM_FRAMES`, and `HOLD_MS`. k-NN uses distance-weighted Euclidean votes over a 72-value vector: wrist-relative and scale-normalized 3D landmarks, palm normal, five curl ratios, and image-plane hand tilt. It does not rotate-normalize because orientation distinguishes several signs. Low-confidence or too-distant input is rejected as unknown.

The handedness self-check is in Calibrate. Raise the right hand and compare the displayed label; turn **Flip label** on if the label is inverted. The choice is kept in local browser storage.

## Add a sign

Add its note/sign entry to `src/data/noteSignMap.js`, then add a corresponding illustration branch to `src/components/SignIllustration.jsx`. The classifier and Calibrate choices derive their note labels from the shared map. Keep camera instructions distinct and record samples for the new label before enabling recognition for it.
