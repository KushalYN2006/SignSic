import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTrainingSamples, loadDefaultSamples, loadPersonalSamples, persistTrainingMode, readTrainingMode, resolveTrainingMode, savePersonalSamples, TRAINING_MODES } from '../lib/datasetStore';
import { createKnnClassifier, recommendThresholds } from '../lib/knnClassifier';
import { MAX_DISTANCE, MIN_CONFIDENCE } from '../config';

export function useDataset() {
  const [defaults, setDefaults] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [mode, setMode] = useState(readTrainingMode);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([loadDefaultSamples(), loadPersonalSamples()]).then(([defaultResult, personalResult]) => {
      if (!active) return;
      const bundled = defaultResult.status === 'fulfilled' ? defaultResult.value : [];
      const local = personalResult.status === 'fulfilled' ? personalResult.value : [];
      setDefaults(bundled);
      setPersonal(local);
      const loadErrors = [];
      if (defaultResult.status === 'rejected') loadErrors.push(defaultResult.reason?.message || 'Default samples could not be loaded.');
      if (personalResult.status === 'rejected') loadErrors.push(`Personal samples could not be read: ${personalResult.reason?.message || 'browser storage unavailable'}`);
      setError(loadErrors.join(' '));

      const initialMode = resolveTrainingMode(readTrainingMode(), bundled, local);
      setMode(initialMode);
      persistTrainingMode(initialMode);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const samples = useMemo(() => getTrainingSamples(mode, defaults, personal), [mode, defaults, personal]);
  const thresholds = useMemo(() => recommendThresholds(samples, { minConfidence: MIN_CONFIDENCE, maxDistance: MAX_DISTANCE }), [samples]);
  const classifier = useMemo(() => {
    const next = createKnnClassifier(thresholds);
    next.train(samples);
    return next;
  }, [samples, thresholds]);
  const replacePersonal = useCallback(async (next) => {
    const safe = next.map((sample) => ({ ...sample, dataset: 'personal' }));
    await savePersonalSamples(safe);
    setPersonal(safe);
  }, []);
  const changeMode = useCallback((next) => {
    if (!TRAINING_MODES.includes(next) || (next !== 'default' && !personal.length)) return;
    setMode(next);
    persistTrainingMode(next);
  }, [personal.length]);

  return {
    samples, defaults, personal, classifier, loaded, error, mode,
    changeMode, replacePersonal,
    hasDataset: samples.length > 0,
    personalCount: personal.length,
    defaultCount: defaults.length,
    thresholds,
  };
}
