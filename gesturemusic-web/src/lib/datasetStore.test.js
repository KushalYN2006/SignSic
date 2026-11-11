import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractFeatures, FEATURE_LENGTH, FEATURE_VERSION } from './features';
import { createKnnClassifier, recommendThresholds } from './knnClassifier';
import { evaluateSamples } from './evaluate';
import bundledDataset from '../../public/data/default_samples.json';
import {
  clearDefaultSamplesCache, getTrainingSamples, loadDefaultSamples,
  persistTrainingMode, readTrainingMode, removePersonalSamples,
  resolveTrainingMode, TRAINING_MODE_KEY, validateDataset,
} from './datasetStore';

const row = (label, features = Array(FEATURE_LENGTH).fill(0), extra = {}) => ({ label, features, source: 'personal', ...extra });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearDefaultSamplesCache();
});

describe('recognition training data', () => {
  it('selects default, personal, or combined samples and weights personal votes twice in both mode', () => {
    const defaults = [row('C')];
    const personal = [row('D')];
    expect(getTrainingSamples('default', defaults, personal).map((item) => item.dataset)).toEqual(['default']);
    expect(getTrainingSamples('mine', defaults, personal).map((item) => item.dataset)).toEqual(['personal']);
    const both = getTrainingSamples('both', defaults, personal);
    expect(both.map((item) => item.dataset)).toEqual(['default', 'personal']);
    const classifier = createKnnClassifier({ k: 2, minConfidence: 0, maxDistance: Infinity });
    classifier.train(both);
    expect(classifier.classify(Array(FEATURE_LENGTH).fill(0)).note).toBe('D');
  });

  it('deletes or clears personal rows without modifying the read-only defaults', () => {
    const defaults = [row('C'), row('D')];
    const before = structuredClone(defaults);
    const personal = [row('C'), row('D')];
    expect(removePersonalSamples(personal, 'C').map((sample) => sample.label)).toEqual(['D']);
    expect(removePersonalSamples(personal)).toEqual([]);
    expect(defaults).toEqual(before);
  });

  it('skips invalid rows, counts them, and emits one warning', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateDataset({ samples: [row('C'), row('D'), row('E', Array(71).fill(0)), row('F', [...Array(71).fill(0), Infinity])] });
    expect(result.invalidCount).toBe(2);
    expect(result.samples).toHaveLength(2);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('refuses datasets when most rows are invalid', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateDataset({ samples: [row('C'), row('H'), row('E', [])] })).toThrow(/2 of 3 rows failed validation/);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('accepts legacy metadata defaults and refuses an incompatible feature version', () => {
    const legacy = validateDataset({ version: 1, samples: [row('C')] });
    expect(legacy.samples[0].features).toBeInstanceOf(Float32Array);
    expect(FEATURE_VERSION).toBe(1);
    expect(FEATURE_LENGTH).toBe(72);
    expect(() => validateDataset({ featureVersion: 2, samples: [row('C')] })).toThrow(/requires version 1/);
    expect(() => validateDataset({ featureLength: 70, samples: [row('C')] })).toThrow(/requires 72/);
  });

  it('derives features from rounded raw landmarks and makes dropped augmentation deterministic', () => {
    const landmarks = Array.from({ length: 21 }, (_, index) => ({ x: index * 0.01, y: index * 0.02, z: index * 0.003 }));
    const rawSample = { ...row('C'), landmarks, worldLandmarks: landmarks, handedness: 'Right' };
    const rawResult = validateDataset({ samples: [rawSample] });
    expect(rawResult.samples[0].features).not.toEqual(Float32Array.from(rawSample.features));
    const input = { source: 'personal', samples: [rawSample] };
    const first = validateDataset(input, { regenerateMissingAugmentation: true }).samples;
    const second = validateDataset(input, { regenerateMissingAugmentation: true }).samples;
    expect(first).toHaveLength(2);
    expect(Array.from(first[1].features)).toEqual(Array.from(second[1].features));
  });

  it('rejects a missing default file and resolves to personal samples when available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadDefaultSamples()).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/data/default_samples.json'), { cache: 'no-cache' });
    expect(resolveTrainingMode('default', [], [row('C')])).toBe('mine');
    expect(resolveTrainingMode('both', [row('C')], [])).toBe('default');
  });

  it('fetches the default file only once and requests a fresh copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, samples: [row('C')] }) });
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([loadDefaultSamples(), loadDefaultSamples()]);
    expect(first).toBe(second);
    expect(first).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/data/default_samples.json'), { cache: 'no-cache' });
  });

  it('persists modes and safely defaults when localStorage reads or writes throw', () => {
    const memory = new Map();
    const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
    expect(readTrainingMode(storage)).toBe('default');
    persistTrainingMode('both', storage);
    expect(memory.get(TRAINING_MODE_KEY)).toBe('both');
    expect(readTrainingMode(storage)).toBe('both');
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readTrainingMode(broken)).toBe('default');
    expect(() => persistTrainingMode('mine', broken)).not.toThrow();
  });

  it('ships the complete default set and derives usable data-based recognition thresholds', () => {
    const { samples, invalidCount } = validateDataset(bundledDataset);
    expect(invalidCount).toBe(0);
    expect(samples).toHaveLength(1264);
    const thresholds = recommendThresholds(getTrainingSamples('default', samples, []));
    expect(thresholds.minConfidence).toBeGreaterThanOrEqual(0.35);
    expect(thresholds.maxDistance).toBeGreaterThan(0);
    expect(thresholds.maxDistance).toBeLessThanOrEqual(4);
  });

  it('produces equivalent features for a left hand and its x-mirrored right-hand copy', () => {
    const landmarks = Array.from({ length: 21 }, (_, index) => ({
      x: 0.2 + (index % 4) * 0.06,
      y: 0.15 + Math.floor(index / 4) * 0.07,
      z: 0.01 * index,
    }));
    const world = landmarks.map((point) => ({ x: point.x - 0.2, y: point.y - 0.15, z: point.z }));
    const mirroredLandmarks = landmarks.map((point) => ({ ...point, x: 1 - point.x }));
    const mirroredWorld = world.map((point) => ({ ...point, x: -point.x }));
    const leftFeatures = extractFeatures(landmarks, world, 'Left');
    const mirroredRightFeatures = extractFeatures(mirroredLandmarks, mirroredWorld, 'Right');
    expect(leftFeatures).toHaveLength(FEATURE_LENGTH);
    leftFeatures.forEach((value, index) => expect(Math.abs(value - mirroredRightFeatures[index])).toBeLessThanOrEqual(1e-6));
  });

  it('recommends finite thresholds from leave-one-group-out neighbors and honors config overrides', () => {
    const samples = ['C', 'D'].flatMap((label, index) => [0, 1].map((take) => ({
      ...row(label, Array(FEATURE_LENGTH).fill(index * 0.5 + take * 0.01)),
      group: `${label}-${take}`, dataset: 'default',
    })));
    const recommended = recommendThresholds(samples);
    expect(Number.isFinite(recommended.minConfidence)).toBe(true);
    expect(Number.isFinite(recommended.maxDistance)).toBe(true);
    expect(recommendThresholds(samples, { minConfidence: 0.52, maxDistance: 0.9 })).toEqual({ minConfidence: 0.52, maxDistance: 0.9 });
  });

  it('holds out whole takes and identifies legacy evaluation groups', () => {
    const labels = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const samples = labels.flatMap((label, labelIndex) => [0, 1].flatMap((takeIndex) => [0, 1].map(() => ({
      ...row(label, Array(FEATURE_LENGTH).fill(labelIndex * 2)),
      take: `${label}-${takeIndex}`,
      dataset: 'personal',
    }))));
    const result = evaluateSamples(samples);
    expect(result.total).toBe(samples.length);
    expect(result.legacy).toBe(false);
    const legacy = evaluateSamples(labels.map((label) => row(label)));
    expect(legacy.legacy).toBe(true);
    expect(legacy.total).toBe(0);
  });
});
