import { useEffect, useState } from 'react';
import { exportSolfege } from '../lib/noteToSign';

export default function ResultsSummary({ result, onTranspose }) {
  const [dismissed, setDismissed] = useState([]);
  useEffect(() => setDismissed([]), [result]);
  if (!result) return null;
  const { meta, summary, warnings, notes } = result;
  const download = (name, body, type) => { const url=URL.createObjectURL(new Blob([body],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url); };
  return <section className="results-summary glass">
    <div className="results-stats">{[['NOTES',summary.note_count],['DURATION',`${meta.duration_s.toFixed(1)}s`],['SIGN COVERAGE',<span className="coverage-ring" style={{'--coverage':`${summary.sign_coverage*100}%`}}>{Math.round(summary.sign_coverage*100)}%</span>],['OCTAVES',summary.octave_range?.join('–')||'—'],['TUNING',`${meta.tuning_cents>0?'+':''}${meta.tuning_cents}¢`],['ENGINE',meta.engine]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    {warnings.filter(w=>!dismissed.includes(w.code)).map(w=><div className="analysis-warning" key={w.code}><span><b>{w.code.replaceAll('_',' ')}</b> {w.message}</span><button aria-label={`Dismiss ${w.code} warning`} onClick={()=>setDismissed(v=>[...v,w.code])}>×</button></div>)}
    {summary.suggested_transpose && summary.sign_coverage<1 && <button className="button button--quiet" onClick={() => onTranspose(summary.suggested_transpose)}>Transpose by {summary.suggested_transpose > 0 ? '+' : ''}{summary.suggested_transpose} and re-analyze</button>}
    <div className="export-actions"><button className="text-button" onClick={()=>download('gesturemusic-analysis.json',JSON.stringify(result,null,2),'application/json')}>Export JSON</button><button className="text-button" onClick={()=>download('gesturemusic-solfege.txt',exportSolfege(notes),'text/plain')}>Export solfège text</button></div>
  </section>;
}
