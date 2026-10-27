import { useState } from 'react';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';
import { playNote } from '../lib/audio';
import SignIllustration from '../components/SignIllustration';

export default function Reference() {
  const [layout, setLayout] = useState('cards');
  return <main className="page page-reference">
    <div className="page-heading"><div><span className="eyebrow">QUICK REVISION</span><h1>Sign reference</h1></div><div className="view-toggle" role="group" aria-label="Reference layout"><button className={layout === 'cards' ? 'selected' : ''} onClick={() => setLayout('cards')}>Cards</button><button className={layout === 'table' ? 'selected' : ''} onClick={() => setLayout('table')}>Table</button></div></div>
    {layout === 'cards' ? <div className="reference-grid">{NOTE_SIGN_MAP.map((item) => <button className="glass reference-card" key={item.note} onClick={() => void playNote(item.note)}><div className="reference-card-head"><span className="reference-note">{item.note[0]}</span><span className="solfege-chip">{item.solfege}</span></div><SignIllustration item={item} compact /><strong>{item.signName}</strong><p>{item.cameraVariant}</p><span className="play-caption">Play note <span>▶</span></span></button>)}</div>
      : <div className="glass reference-table-wrap"><table className="reference-table"><thead><tr><th>Note</th><th>Solfège</th><th>Sign</th><th>Camera variant</th><th>Audio</th></tr></thead><tbody>{NOTE_SIGN_MAP.map((item) => <tr key={item.note}><td><b>{item.note}</b></td><td>{item.solfege}</td><td>{item.signName}</td><td>{item.cameraVariant}</td><td><button className="icon-button" aria-label={`Play ${item.note}`} onClick={() => void playNote(item.note)}>▶</button></td></tr>)}</tbody></table></div>}
    <p className="fixed-do-note">Fixed-do is used in this version: C = Do, D = Re, through B = Ti. Traditional Kodály teaching usually uses movable-do.</p>
  </main>;
}
