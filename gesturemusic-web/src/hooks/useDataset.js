import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadDefaultSamples, loadPersonalSamples, savePersonalSamples } from '../lib/datasetStore';
import { createKnnClassifier } from '../lib/knnClassifier';

export function useDataset() {
  const [defaults, setDefaults] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([loadDefaultSamples(), loadPersonalSamples()])
      .then(([bundled, local]) => { setDefaults(bundled); setPersonal(local); setLoaded(true); })
      .catch((reason) => { setError(reason.message); setLoaded(true); });
  }, []);

  const samples = useMemo(() => [...defaults, ...personal], [defaults, personal]);
  const classifier = useMemo(() => {
    const next = createKnnClassifier();
    next.train(samples);
    return next;
  }, [samples]);
  const replacePersonal = useCallback(async (next) => {
    setPersonal(next);
    await savePersonalSamples(next);
  }, []);
  return { samples, personal, classifier, loaded, error, replacePersonal, hasDataset: samples.length > 0 };
}
