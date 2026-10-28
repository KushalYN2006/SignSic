import { KNN_K, MAX_DISTANCE, MIN_CONFIDENCE } from '../config';

const euclidean = (a, b) => {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
};

export function createKnnClassifier({ k = KNN_K, minConfidence = MIN_CONFIDENCE, maxDistance = MAX_DISTANCE } = {}) {
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
        const personalizationWeight = sample.source === 'default' ? 0.75 : 1.25;
        const weight = personalizationWeight / Math.max(distance, 1e-4);
        votes.set(sample.label, (votes.get(sample.label) || 0) + weight);
      }
      const total = [...votes.values()].reduce((sum, value) => sum + value, 0);
      const [note, winningWeight] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
      const confidence = winningWeight / total;
      return confidence >= minConfidence ? { note, confidence, distance: nearest[0].distance } : null;
    },
    serialize() {
      return samples.map((sample) => ({ label: sample.label, features: Array.from(sample.features), source: sample.source || 'personal' }));
    },
    load(serialized) {
      samples = serialized.map((sample) => ({ ...sample, features: Float32Array.from(sample.features) }));
    },
    get size() { return samples.length; },
  };
}
