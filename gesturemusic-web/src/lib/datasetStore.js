const DB_NAME = 'gesturemusic-local';
const STORE_NAME = 'samples';
const REFERENCE_STORE = 'references';
const KEY = 'personal';

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
    request.onsuccess = () => { db.close(); resolve((request.result || []).map((sample) => ({ ...sample, features: Float32Array.from(sample.features) }))); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function savePersonalSamples(samples) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(samples.map((sample) => ({ ...sample, features: Array.from(sample.features) })), KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadDefaultSamples() {
  const response = await fetch('/data/default_samples.json');
  if (!response.ok) throw new Error('Could not load the bundled sample dataset.');
  const dataset = await response.json();
  return (dataset.samples || []).map((sample) => ({ ...sample, source: 'default', features: Float32Array.from(sample.features) }));
}

export function exportSamples(samples) {
  const blob = new Blob([JSON.stringify({ version: 1, samples: samples.map((sample) => ({ ...sample, features: Array.from(sample.features) })) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'gesturemusic-samples.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importSamples(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.samples)) throw new Error('Dataset JSON must contain a samples array.');
  return data.samples.filter((sample) => sample.label && Array.isArray(sample.features) && sample.features.length === 72)
    .map((sample) => ({ ...sample, source: 'personal', features: Float32Array.from(sample.features) }));
}
