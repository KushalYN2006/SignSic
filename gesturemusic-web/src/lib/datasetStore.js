import { extractFeatures, FEATURE_LENGTH, FEATURE_VERSION, augmentFeatures } from './features';

const DB_NAME = 'gesturemusic-local';
const STORE_NAME = 'samples';
const REFERENCE_STORE = 'references';
const KEY = 'personal';
export const TRAINING_MODE_KEY = 'gm.trainingMode';
export const TRAINING_MODES = ['default', 'mine', 'both'];
const LABELS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
let defaultSamplesPromise;

function deriveRawFeatures(sample) {
  if (sample.source === 'augmented') return null;
  const world = sample.worldLandmarks;
  const image = sample.landmarks;
  const validPoints = (points) => Array.isArray(points) && points.length === 21
    && points.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  if (!validPoints(world)) return null;
  const features = extractFeatures(validPoints(image) ? image : world, world, sample.handedness, Boolean(sample.flipHandedness));
  return features?.length === FEATURE_LENGTH && [...features].every(Number.isFinite) ? features : null;
}

export function readTrainingMode(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const mode = target?.getItem(TRAINING_MODE_KEY);
    return TRAINING_MODES.includes(mode) ? mode : 'default';
  } catch {
    return 'default';
  }
}

export function persistTrainingMode(mode, storage) {
  if (!TRAINING_MODES.includes(mode)) return;
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(TRAINING_MODE_KEY, mode);
  } catch { /* Private browsing may block storage. */ }
}

export function validateDataset(dataset, { regenerateMissingAugmentation = false } = {}) {
  if (!dataset || !Array.isArray(dataset.samples)) throw new Error('Dataset JSON must contain a samples array.');
  const version = dataset.featureVersion ?? 1;
  const length = dataset.featureLength ?? FEATURE_LENGTH;
  if (version !== FEATURE_VERSION) throw new Error(`Incompatible feature version ${version}; this app requires version ${FEATURE_VERSION}.`);
  if (length !== FEATURE_LENGTH) throw new Error(`Incompatible feature length ${length}; this app requires ${FEATURE_LENGTH}.`);

  let invalidCount = 0;
  const samples = [];
  for (const sample of dataset.samples) {
    const derivedFeatures = sample && typeof sample === 'object' ? deriveRawFeatures(sample) : null;
    const storedFeaturesAreValid = Array.isArray(sample?.features)
      && sample.features.length === FEATURE_LENGTH
      && sample.features.every(Number.isFinite);
    if (!sample || !LABELS.has(sample.label) || (!derivedFeatures && !storedFeaturesAreValid)) {
      invalidCount += 1;
      continue;
    }
    samples.push({ ...sample, dataset: 'default', features: Float32Array.from(derivedFeatures || sample.features) });
  }
  if (invalidCount) console.warn(`Skipped ${invalidCount} invalid row${invalidCount === 1 ? '' : 's'} in the recognition dataset.`);
  if (invalidCount > dataset.samples.length / 2) {
    throw new Error(`The default recognition dataset is invalid: ${invalidCount} of ${dataset.samples.length} rows failed validation.`);
  }
  if (samples.length === 0) throw new Error('The default recognition dataset contains no usable samples.');
  return { samples: regenerateMissingAugmentation ? maybeRegenerateAugmentation(samples) : samples, invalidCount };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function maybeRegenerateAugmentation(samples) {
  if (samples.some((sample) => sample.source === 'augmented')) return samples;
  const recorded = samples.filter((sample) => sample.source !== 'augmented');
  const generated = recorded.map((sample, index) => ({
    ...sample,
    source: 'augmented',
    generated: true,
    features: augmentFeatures(sample.features, {
      scale: (seededRandom(0x47534D + index)() - 0.5) * 0.04,
      angle: (seededRandom(0x504F53 + index)() * 2 - 1) * (8 * Math.PI / 180),
      noise: 0.01,
      random: seededRandom(0x415547 + index),
    }),
  }));
  return [...samples, ...generated];
}

export function getTrainingSamples(mode, defaults, personal) {
  const safeMode = TRAINING_MODES.includes(mode) ? mode : 'default';
  const defaultRows = defaults.map((sample) => ({ ...sample, dataset: 'default' }));
  const personalRows = personal.map((sample) => ({ ...sample, dataset: 'personal' }));
  if (safeMode === 'mine') return personalRows;
  if (safeMode === 'both') return [...defaultRows, ...personalRows];
  return defaultRows;
}

export function resolveTrainingMode(preferred, defaults, personal) {
  if (!defaults.length && personal.length) return 'mine';
  if (preferred !== 'default' && !personal.length) return 'default';
  return TRAINING_MODES.includes(preferred) ? preferred : 'default';
}

export function removePersonalSamples(personal, label = null) {
  return label ? personal.filter((sample) => sample.label !== label) : [];
}

export function clearDefaultSamplesCache() {
  defaultSamplesPromise = undefined;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      if (!request.result.objectStoreNames.contains(REFERENCE_STORE)) request.result.createObjectStore(REFERENCE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadReferenceImage(label) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(REFERENCE_STORE).objectStore(REFERENCE_STORE).get(label);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function saveReferenceImage(label, image) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REFERENCE_STORE, 'readwrite');
    tx.objectStore(REFERENCE_STORE).put(image, label);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadPersonalSamples() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => { db.close(); resolve((request.result || []).map((sample) => ({ ...sample, dataset: 'personal', features: Float32Array.from(deriveRawFeatures(sample) || sample.features) }))); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function savePersonalSamples(samples) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(samples.map((sample) => ({ ...sample, dataset: 'personal', features: Array.from(sample.features) })), KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function loadDefaultSamples() {
  if (!defaultSamplesPromise) {
    defaultSamplesPromise = fetch(`${import.meta.env.BASE_URL}data/default_samples.json`, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load bundled recognition samples (HTTP ${response.status}).`);
        return response.json();
      })
      .then((dataset) => validateDataset(dataset, { regenerateMissingAugmentation: true }))
      .then((result) => result.samples)
      .catch((error) => { defaultSamplesPromise = undefined; throw error; });
  }
  return defaultSamplesPromise;
}

export function exportSamples(samples) {
  const blob = new Blob([JSON.stringify({ version: 1, featureVersion: FEATURE_VERSION, featureLength: FEATURE_LENGTH, samples: samples.map((sample) => ({ ...sample, features: Array.from(sample.features) })) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'gesturemusic-samples.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importSamples(file) {
  const data = JSON.parse(await file.text());
  const { samples } = validateDataset(data);
  return samples.map(({ dataset: _dataset, generated: _generated, ...sample }) => ({ ...sample, source: sample.source === 'augmented' ? 'augmented' : 'personal', dataset: 'personal' }));
}
