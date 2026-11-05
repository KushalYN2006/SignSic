const stamp = n => `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export default function TransportBar({ playback, duration }) {
  const { time, playing, play, pause, seek, speed, setSpeed, mode, setMode } = playback;
  return <section className="transport glass"><audio ref={playback.audioRef} src={playback.audioUrl} preload="metadata" />
    <button className="button button--aqua" onClick={() => playing ? pause() : play()}>{playing ? 'Pause' : 'Play'}</button>
    <span className="time-readout">{stamp(time)} / {stamp(duration)}</span><input aria-label="Seek audio" type="range" min="0" max={duration||1} step="0.01" value={Math.min(time,duration||0)} onChange={e => seek(Number(e.target.value))} />
    <label>Speed <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.5,0.75,1].map(n=><option key={n} value={n}>{n}×</option>)}</select></label>
    <label>Audio <select value={mode} onChange={e => setMode(e.target.value)}><option value="original">Original</option><option value="detected">Detected notes</option><option value="both">Both</option></select></label>
  </section>;
}
