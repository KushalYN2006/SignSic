import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIRM_FRAMES, HOLD_MS } from '../config';
import { playNote } from '../lib/audio';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';

function randomTarget(previous, availableNotes) {
  const trained = NOTE_SIGN_MAP.filter((item) => availableNotes.includes(item.note[0]));
  const pool = trained.length ? trained : NOTE_SIGN_MAP;
  const options = pool.filter((item) => item.note[0] !== previous);
  if (!options.length) return pool[0];
  return options[Math.floor(Math.random() * options.length)];
}

export function usePracticeSession(classifier, hasDataset, initialTarget, availableNotes = []) {
  const availableKey = availableNotes.join('');
  const [target, setTarget] = useState(() => NOTE_SIGN_MAP.find((item) => item.note[0] === initialTarget && (!availableNotes.length || availableNotes.includes(initialTarget))) || NOTE_SIGN_MAP.find((item) => availableNotes.includes(item.note[0])) || NOTE_SIGN_MAP[0]);
  const [mode, setMode] = useState('guided');
  const [hint, setHint] = useState(false);
  const [status, setStatus] = useState('waiting');
  const [feedback, setFeedback] = useState('Start the camera and make a sign.');
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState({ correct: 0, attempts: 0, streak: 0, best: 0 });
  const [noteStates, setNoteStates] = useState({});
  const seenRef = useRef({ note: '', frames: 0, holdStart: 0, scored: false });
  const advanceTimer = useRef(0);
  const sessionEpoch = useRef(0);
  const hintUsed = useRef(false);

  const next = useCallback(() => {
    window.clearTimeout(advanceTimer.current);
    setProgress(0);
    setHint(false);
    hintUsed.current = false;
    setTarget((previous) => randomTarget(previous.note[0], availableKey.split('')));
    setStatus('detecting');
    setFeedback('Show the target sign and hold it steady.');
    seenRef.current = { note: '', frames: 0, holdStart: 0, scored: false };
  }, [availableKey]);

  useEffect(() => {
    const candidates = NOTE_SIGN_MAP.filter((item) => availableKey.includes(item.note[0]));
    if (candidates.length && !availableKey.includes(target.note[0])) setTarget(candidates[0]);
  }, [availableKey, target.note]);

  const skip = useCallback(() => {
    setScore((s) => ({ ...s, attempts: s.attempts + 1, streak: 0 }));
    next();
  }, [next]);

  const revealHint = useCallback(() => {
    if (!hintUsed.current) {
      hintUsed.current = true;
      setScore((s) => ({ ...s, attempts: s.attempts + 1 }));
    }
    setHint(true);
  }, []);

  const processHand = useCallback((hand) => {
    if (!hasDataset) { setStatus('waiting'); setFeedback('Calibrate signs or import a dataset to enable recognition.'); return; }
    if (!hand?.features) {
      seenRef.current = { note: '', frames: 0, holdStart: 0, scored: false };
      setStatus('waiting'); setProgress(0); setFeedback('Show your whole hand in the camera.');
      return;
    }
    const prediction = classifier.classify(hand.features);
    if (!prediction) {
      seenRef.current = { note: '', frames: 0, holdStart: 0, scored: false };
      setStatus('detecting'); setProgress(0);
      setFeedback(hand.confidence < 0.5 ? 'Try brighter light and keep your wrist in frame.' : 'Sign not recognized yet. Hold a clear shape.');
      return;
    }
    const previous = seenRef.current;
    if (previous.note !== prediction.note) {
      seenRef.current = { note: prediction.note, frames: 1, holdStart: 0, scored: false };
      setStatus(prediction.note === target.note[0] ? 'detecting' : 'wrong');
      if (prediction.note !== target.note[0]) {
        const guessed = NOTE_SIGN_MAP.find((item) => item.note[0] === prediction.note);
        const confusion = NOTE_SIGN_MAP.find((item) => item.note === target.note)?.commonConfusions || [];
        const tip = confusion.includes(guessed?.solfege) ? `Tip: ${guessed.solfege} is a common mix-up; ${target.solfege} has a different hand orientation.` : `${guessed?.solfege || prediction.note} detected. Check the target sign’s hand shape.`;
        setFeedback(`That looked like ${guessed?.solfege || prediction.note}. ${tip}`);
      }
      return;
    }
    previous.frames += 1;
    if (previous.frames < CONFIRM_FRAMES) {
      setStatus('detecting');
      return;
    }
    if (prediction.note !== target.note[0]) { setStatus('wrong'); return; }
    if (!previous.holdStart) previous.holdStart = hand.timestamp;
    const heldMs = hand.timestamp - previous.holdStart;
    const holdProgress = Math.min(1, heldMs / HOLD_MS);
    setProgress(holdProgress);
    if (holdProgress < 1) { setStatus('holding'); setFeedback(`Correct sign. Hold steady for ${Math.ceil((HOLD_MS - heldMs) / 100) / 10}s.`); return; }
    if (previous.scored) return;
    previous.scored = true;
    setStatus('correct');
    setFeedback(`${target.solfege} is correct. Nice work.`);
    setScore((s) => ({ correct: s.correct + 1, attempts: s.attempts + 1, streak: s.streak + 1, best: Math.max(s.best, s.streak + 1) }));
    setNoteStates((states) => ({ ...states, [target.note[0]]: 'correct' }));
    void playNote(target.note, 0.7, 0.6);
    const epoch = sessionEpoch.current;
    advanceTimer.current = window.setTimeout(() => { if (epoch === sessionEpoch.current) next(); }, 1200);
  }, [classifier, hasDataset, target, next]);

  useEffect(() => () => { sessionEpoch.current += 1; window.clearTimeout(advanceTimer.current); }, []);
  const resetScore = () => { setScore({ correct: 0, attempts: 0, streak: 0, best: 0 }); setNoteStates({}); };
  return { target, mode, setMode, hint, setHint, revealHint, status, feedback, progress, score, noteStates, processHand, skip, resetScore, accuracy: score.attempts ? Math.round((score.correct / score.attempts) * 100) : 0 };
}
