import { useRef, useState } from 'react';

const samples = [['scale', 'C major scale'], ['twinkle', 'Twinkle Twinkle'], ['ode', 'Ode to Joy']];
const valid = file => file && /\.(wav|mp3|m4a|ogg|flac)$/i.test(file.name);

export default function UploadDropzone({ onFile, busy }) {
  const input = useRef(null); const [drag, setDrag] = useState(false); const [message, setMessage] = useState('');
  const accept = file => {
    if (!valid(file)) return setMessage('Choose a WAV, MP3, M4A, OGG, or FLAC file.');
    if (file.size > 20 * 1024 * 1024) return setMessage('Files must be 20 MB or smaller.');
    setMessage(''); onFile(file);
  };
  const sample = async key => { const r = await fetch(`${import.meta.env.BASE_URL}samples/${key}.wav`); if (!r.ok) return setMessage('Sample clips are not available in this build yet.'); const b = await r.blob(); accept(new File([b], `${key}.wav`, { type: 'audio/wav' })); };
  return <section className={`upload-drop glass ${drag ? 'upload-drop--active' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}>
    <input ref={input} hidden type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/ogg,audio/flac,.m4a" onChange={e => accept(e.target.files[0])} />
    <div className="upload-symbol">♫</div><h2>Drop a melody recording</h2><p>One instrument, one melody line · WAV, MP3, M4A, OGG, or FLAC · up to 20 MB and 60 seconds</p>
    <button className="button button--aqua" disabled={busy} onClick={() => input.current?.click()}>Choose audio file</button>
    <div className="sample-row"><span>TRY A SAMPLE</span>{samples.map(([key, label]) => <button key={key} className="text-button" disabled={busy} onClick={() => sample(key)}>{label}</button>)}</div>
    {message && <p className="inline-message" role="alert">{message}</p>}
  </section>;
}
