import SignPhoto from './SignPhoto';
import { noteToSign } from '../lib/noteToSign';

export default function SignPlayer({ notes, index, time }) {
  const note = index >= 0 ? notes[index] : null, sign = note && noteToSign(note);
  const next = notes.filter(n => n.start_s > time).slice(0, 3);
  return <section className="sign-player glass glass--strong">
    <span className="eyebrow">NOW PLAYING</span>
    {note && sign ? <><SignPhoto item={sign} compact /><div className="player-note"><strong>{sign.solfege}</strong><span>{note.note}</span><b>{note.octave < 4 ? '⌄' : note.octave > 4 ? '⌃' : '＝'} {note.octave}</b></div></> : note ? <div className="rest-card"><strong>{note.note}</strong><span>No sign in v1 · accidental</span></div> : <div className="rest-card"><strong>Rest</strong><span>{notes.length ? 'No note at this moment' : 'Upload a melody to begin'}</span></div>}
    <div className="next-strip"><span className="micro-label">NEXT UP</span><div>{next.length ? next.map(n => { const s = noteToSign(n); return <div key={n.id} className="next-note"><b>{s?.solfege || n.pitch_class}</b><small>{Math.max(0, n.start_s-time).toFixed(1)}s</small></div>; }) : <small>End of sequence</small>}</div></div>
  </section>;
}
