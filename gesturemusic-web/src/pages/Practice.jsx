import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';
import { useDataset } from '../hooks/useDataset';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { useWebcam } from '../components/WebcamPanel';
import WebcamPanel from '../components/WebcamPanel';
import HoldRing from '../components/HoldRing';
import SignPhoto from '../components/SignPhoto';

export default function Practice() {
  const location = useLocation();
  const dataset = useDataset();
  const trainedLabels = useMemo(() => [...new Set(dataset.samples.map((sample) => sample.label))], [dataset.samples]);
  const session = usePracticeSession(dataset.classifier, dataset.hasDataset, location.state?.target, trainedLabels);
  const tracker = useWebcam(true);
  const [showRaw, setShowRaw] = useState(false);
  const previousHand = useRef(null);
  const requestedAutoStart = useRef(false);
  useEffect(() => {
    if (location.state?.target && !requestedAutoStart.current) {
      requestedAutoStart.current = true;
      void tracker.start();
    }
  }, [location.state, tracker.start]);
  useEffect(() => {
    if (tracker.hand !== previousHand.current) {
      previousHand.current = tracker.hand;
      session.processHand(tracker.hand);
    }
  }, [tracker.hand, session.processHand]);
  const symbol = NOTE_SIGN_MAP.find((item) => item.note[0] === session.target.note[0]);
  return <main className="page page-practice">
    <div className="page-heading page-heading--compact"><div><span className="eyebrow">LIVE SESSION</span><h1>Practice</h1></div><div className="score-strip"><div><strong>{session.score.correct}</strong><small>correct</small></div><div><strong>{session.accuracy}%</strong><small>accuracy</small></div><div><strong>{session.score.streak}</strong><small>streak</small></div><button className="text-button" onClick={session.resetScore}>Reset</button></div></div>
    {(!dataset.hasDataset || trainedLabels.length < NOTE_SIGN_MAP.length) && <div className="dataset-banner glass"><span>{dataset.hasDataset ? `Training covers ${trainedLabels.length} of 7 signs. Practice targets use trained signs only.` : 'Recognition needs training samples.'}</span><Link to="/calibrate">Open Calibrate <span>↗</span></Link></div>}
    <div className="practice-layout">
      <div className="practice-camera-column"><WebcamPanel tracker={tracker} showRaw={showRaw} onToggleRaw={setShowRaw} /><div className="feedback-bar glass" data-state={session.status}><span className="feedback-dot"/><span>{session.feedback}</span><span className="fps-label">{session.status.toUpperCase()}</span></div></div>
      <section className={`glass target-card target-card--${session.status}`}>
        <div className="target-top"><span className="micro-label">YOUR NOTE</span><span className="target-count">{session.score.attempts + 1} <i>/ ROUND</i></span></div>
        <div className="mode-switch" role="group" aria-label="Practice mode"><button className={session.mode === 'guided' ? 'selected' : ''} onClick={() => session.setMode('guided')}>Guided</button><button className={session.mode === 'challenge' ? 'selected' : ''} onClick={() => session.setMode('challenge')}>Challenge</button></div>
        <HoldRing progress={session.progress} state={session.status}><div className="target-letter">{session.target.note[0]}</div><div className="target-solfege">{session.target.solfege}</div></HoldRing>
        {session.mode === 'guided' || session.hint ? <div className="target-sign"><SignPhoto item={symbol} compact /></div> : <button className="text-button hint-button" onClick={session.revealHint}>Show hint <small>counts against score</small></button>}
        <div className="target-actions"><button className="button button--quiet" onClick={session.skip}>Skip <span>→</span></button></div>
      </section>
    </div>
    <div className="practice-footer"><div className="note-status-strip">{NOTE_SIGN_MAP.map((item) => <span key={item.note} className={session.noteStates[item.note[0]] ? 'done' : ''} title={`${item.solfege}: ${item.note}`}>{item.note[0]}</span>)}</div><span>Best streak <b>{session.score.best}</b></span></div>
  </main>;
}
