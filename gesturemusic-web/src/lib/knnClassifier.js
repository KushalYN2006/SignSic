import { KNN_K, MAX_DISTANCE, MIN_CONFIDENCE } from '../config';

const euclidean = (a, b) => {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
};

export function createKnnClassifier({ k = KNN_K, minConfidence = MIN_CONFIDENCE ?? 0.6, maxDistance = MAX_DISTANCE ?? 1.35 } = {}) {
  let samples = [];
  return {
    train(nextSamples) {
      samples = nextSamples.filter((sample) => sample.features && sample.label);
    },
    classify(features) {
      if (!features || samples.length === 0) return null;
      const nearest = samples.map((sample) => ({ sample, distance: euclidean(features, sample.features) }))
        .sort((a, b) => a.distance - b.distance).slice(0, k);
      if (!nearest.length || nearest[0].distance > maxDistance) return null;
      const votes = new Map();
      for (const { sample, distance } of nearest) {
        const personalizationWeight = sample.dataset === 'personal' ? 2 : 1;
        const weight = personalizationWeight / Math.max(distance, 1e-4);
        votes.set(sample.label, (votes.get(sample.label) || 0) + weight);
      }
      const total = [...votes.values()].reduce((sum, value) => sum + value, 0);
      const [note, winningWeight] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
      const confidence = winningWeight / total;
      return confidence >= minConfidence ? { note, confidence, distance: nearest[0].distance } : null;
    },
    serialize() {
      return samples.map((sample) => ({ ...sample, features: Array.from(sample.features), source: sample.source || 'personal' }));
    },
    load(serialized) {
      samples = serialized.map((sample) => ({ ...sample, features: Float32Array.from(sample.features) }));
    },
    get size() { return samples.length; },
  };
}

const percentile = (values, quantile) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

export function recommendThresholds(samples, overrides = {}) {
  const fallback = { minConfidence: 0.6, maxDistance: 1.35 };
  const groups = new Map();
  let previousLegacy = null;
  let legacyIndex = 0;
  for (const sample of samples) {
    let key;
    if (sample.take) {
      key = `take:${sample.dataset || sample.source || 'samples'}:${sample.take}`;
      previousLegacy = null;
    } else if (sample.group) {
      key = `group:${sample.dataset || sample.source || 'samples'}:${sample.group}`;
      previousLegacy = null;
    } else {
      const scopeLabel = `${sample.dataset || sample.source || 'legacy'}:${sample.label}`;
      if (previousLegacy?.scope !== scopeLabel) previousLegacy = { scope: scopeLabel, id: `run:${legacyIndex++}` };
      key = previousLegacy.id;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }

  const representatives = [...groups.entries()].filter(([, rows]) => rows.length).map(([key, rows]) => ({ key, sample: rows.find((row) => row.source === 'personal') || rows[0] }));
  const queries = representatives.length > 256
    ? representatives.filter((_, index) => index % Math.ceil(representatives.length / 256) === 0).slice(0, 256)
    : representatives;
  const distances = [];
  const confidences = [];
  for (const { key, sample: query } of queries) {
    const nearest = [];
    for (const [candidateKey, rows] of groups) {
      if (candidateKey === key) continue;
      for (const candidate of rows) {
        const distance = euclidean(query.features, candidate.features);
        if (!Number.isFinite(distance)) continue;
        const entry = { sample: candidate, distance };
        let at = nearest.findIndex((item) => item.distance > distance);
        if (at < 0) at = nearest.length;
        if (at < KNN_K) {
          nearest.splice(at, 0, entry);
          if (nearest.length > KNN_K) nearest.pop();
        }
      }
    }
    if (!nearest.length) continue;
    const votes = new Map();
    for (const item of nearest) {
      const weight = (item.sample.dataset === 'personal' ? 2 : 1) / Math.max(item.distance, 1e-4);
      votes.set(item.sample.label, (votes.get(item.sample.label) || 0) + weight);
    }
    const voteTotal = [...votes.values()].reduce((sum, value) => sum + value, 0);
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (winner?.[0] === query.label) {
      distances.push(nearest[0].distance);
      confidences.push(winner[1] / voteTotal);
    }
  }
  const measuredDistance = percentile(distances, 0.95);
  const measuredConfidence = percentile(confidences, 0.05);
  return {
    minConfidence: Number.isFinite(overrides.minConfidence) ? overrides.minConfidence : measuredConfidence === null ? fallback.minConfidence : Math.min(0.75, Math.max(0.35, measuredConfidence * 0.9)),
    maxDistance: Number.isFinite(overrides.maxDistance) ? overrides.maxDistance : measuredDistance === null ? fallback.maxDistance : Math.min(4, Math.max(0.05, measuredDistance * 1.2)),
  };
}
