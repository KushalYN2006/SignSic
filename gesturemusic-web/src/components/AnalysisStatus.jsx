import { useEffect, useState } from 'react';

export default function AnalysisStatus({ busy, error, cancel }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { if (!busy) { setSeconds(0); return; } const id = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(id); }, [busy]);
  if (!busy && !error) return null;
  return <div className={`analysis-status glass ${error ? 'analysis-status--error' : ''}`} role={error ? 'alert' : 'status'}>
    {busy ? <><span className="analysis-spinner" /><span>Listening for notes… {seconds}s</span><button className="text-button" onClick={cancel}>Cancel</button></> : <><span>{error}</span><button className="text-button" onClick={cancel}>Dismiss</button></>}
  </div>;
}
