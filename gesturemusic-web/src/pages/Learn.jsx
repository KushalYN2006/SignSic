import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';
import { playNote } from '../lib/audio';
import NoteKey from '../components/NoteKey';
import SignPhoto from '../components/SignPhoto';

export default function Learn() {
  const [index, setIndex] = useState(0);
  const item = NOTE_SIGN_MAP[index];
  const change = (amount) => setIndex((value) => (value + amount + NOTE_SIGN_MAP.length) % NOTE_SIGN_MAP.length);
  return <main className="page page-learn">
    <div className="page-heading"><div><span className="eyebrow">SOLFÈGE, MADE VISIBLE</span><h1>Learn a sign.<br /><em>Hear the note.</em></h1></div><p>Seven fixed-do notes, paired with camera-friendly Kodály hand signs.</p></div>
    <div className="learn-layout">
      <div className="learn-left">
        <div className="note-keys" aria-label="Choose a note">{NOTE_SIGN_MAP.map((note, i) => <NoteKey key={note.note} item={note} active={i === index} onClick={() => setIndex(i)} />)}</div>
        <section className="glass lesson-card">
          <div className="lesson-head"><div><span className="eyebrow">NOTE {String(index + 1).padStart(2, '0')} / 07</span><h2>{item.signName}</h2></div><div className="solfege-chip">{item.solfege}</div></div>
          <p>{item.description}</p>
          <div className="howto"><span className="micro-label">ON CAMERA</span><p>{item.cameraVariant}</p></div>
          <div className="lesson-actions"><button className="button button--aqua" onClick={() => void playNote(item.note)}>▶ <span>Play {item.note}</span></button><Link className="button button--quiet" to="/practice" state={{ target: item.note[0] }}>Try it <span aria-hidden="true">↗</span></Link><div className="lesson-arrows"><button aria-label="Previous note" onClick={() => change(-1)}>←</button><button aria-label="Next note" onClick={() => change(1)}>→</button></div></div>
        </section>
      </div>
      <section className="glass sign-card"><div className="sign-card-top"><span className="micro-label">TRADITIONAL SIGN</span><span className="orientation-tag">{item.note[0]} · {item.solfege}</span></div><SignPhoto item={item} /><div className="sign-card-bottom"><span className="note-large">{item.note[0]}</span><div><strong>{item.solfege}</strong><small>{item.signName}</small></div><span className="midi-tag">MIDI {item.midi}</span></div></section>
    </div>
  </main>;
}
