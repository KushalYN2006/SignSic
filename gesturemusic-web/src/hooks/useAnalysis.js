import { useCallback, useRef, useState } from 'react';
import { analyzeAudio } from '../lib/api';

export function useAnalysis() {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const analyze = useCallback(async (file, options) => {
    controller.current?.abort();
    controller.current = new AbortController();
    setStatus('analyzing'); setError('');
    try { const data = await analyzeAudio(file, options, controller.current.signal); setResult(data); setStatus('ready'); return data; }
    catch (err) { if (err.name !== 'AbortError') { setError(err.message); setStatus('error'); } return null; }
  }, []);
  const cancel = useCallback(() => { controller.current?.abort(); setStatus('idle'); }, []);
  const clear = useCallback(() => { controller.current?.abort(); setResult(null); setError(''); setStatus('idle'); }, []);
  return { status, result, error, analyze, cancel, clear };
}
