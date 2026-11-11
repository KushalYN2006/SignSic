import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export function activeNoteIndex(notes, time) {
  let lo = 0, hi = notes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, note = notes[mid];
    if (time < note.start_s) hi = mid - 1;
    else if (time >= note.end_s) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export function usePlayback(notes = [], duration = 0, audioUrl = '') {
  const audioRef = useRef(null), partRef = useRef(null), synthRef = useRef(null), frameRef = useRef(0);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1), [mode, setMode] = useState('original');
  const currentIndex = activeNoteIndex(notes, time);
  const stopPart = useCallback(() => { partRef.current?.stop(); partRef.current?.dispose(); partRef.current = null; Tone.Transport.stop(); Tone.Transport.cancel(); }, []);
  const play = useCallback(async () => {
    if (!audioRef.current) return;
    if (mode !== 'detected') { try { await audioRef.current.play(); } catch { return; } }
    if (mode !== 'original') {
      await Tone.start();
      synthRef.current ||= new Tone.Synth({ oscillator: { type: 'triangle' } }).toDestination();
      stopPart();
      partRef.current = new Tone.Part((at, note) => synthRef.current.triggerAttackRelease(note.name, note.duration, at, 0.7), notes.map(n => [n.start_s, { name: n.note, duration: Math.max(.08, n.duration_s * .9) }])).start(0);
      Tone.Transport.seconds = time; Tone.Transport.start();
      Tone.Transport.scheduleOnce(() => { Tone.Transport.pause(); setPlaying(false); }, duration);
    }
    setPlaying(true);
  }, [duration, mode, notes, stopPart, time]);
  const pause = useCallback(() => { audioRef.current?.pause(); Tone.Transport.pause(); setPlaying(false); }, []);
  const seek = useCallback((next) => { const t = Math.max(0, Math.min(duration, next)); if (audioRef.current) audioRef.current.currentTime = t; Tone.Transport.seconds = t; setTime(t); }, [duration]);
  useEffect(() => { if (audioRef.current) { audioRef.current.playbackRate = speed; audioRef.current.preservesPitch = true; audioRef.current.webkitPreservesPitch = true; } }, [speed, audioUrl]);
  useEffect(() => { Tone.Transport.playbackRate = speed; }, [speed]);
  useEffect(() => {
    const tick = () => { const t = mode === 'detected' ? Tone.Transport.seconds : (audioRef.current?.currentTime || 0); setTime(t); frameRef.current = requestAnimationFrame(tick); };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [mode]);
  useEffect(() => {
    pause();
    stopPart();
    setTime(0);
  }, [audioUrl, pause, stopPart]);
  useEffect(() => () => {
    audioRef.current?.pause();
    stopPart();
    synthRef.current?.dispose();
    synthRef.current = null;
  }, [stopPart]);
  useEffect(() => { if (!playing || mode === 'detected') return; const onEnd = () => setPlaying(false); const el = audioRef.current; el?.addEventListener('ended', onEnd); return () => el?.removeEventListener('ended', onEnd); }, [playing, mode]);
  const changeMode = useCallback(next => { if (next !== mode) { pause(); stopPart(); setMode(next); } }, [mode, pause, stopPart]);
  return { audioRef, audioUrl, currentIndex, time, playing, speed, setSpeed, mode, setMode: changeMode, play, pause, seek };
}
