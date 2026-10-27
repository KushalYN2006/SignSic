import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';
import { RECORD_DURATION_MS, RECORD_SAMPLE_COUNT } from '../config';
import { useWebcam } from '../components/WebcamPanel';
import WebcamPanel from '../components/WebcamPanel';
import SignPhoto from '../components/SignPhoto';
import NoteKey from '../components/NoteKey';
import ConfusionMatrix from '../components/ConfusionMatrix';
import { augmentFeatures } from '../lib/features';
import { evaluateSamples } from '../lib/evaluate';
import { exportSamples, importSamples, loadReferenceImage, saveReferenceImage } from '../lib/datasetStore';
import { useDataset } from '../hooks/useDataset';

function captureCroppedReference(video, landmarks) {
  if (!video || video.readyState < 2 || !video.videoWidth || !landmarks?.length) {
    throw new Error('Start the camera and show your whole hand first.');
  }
  const xs = landmarks.map((point) => point.x * video.videoWidth);
  const ys = landmarks.map((point) => point.y * video.videoHeight);
  const handWidth = Math.max(...xs) - Math.min(...xs);
  const handHeight = Math.max(...ys) - Math.min(...ys);
  const padX = Math.max(handWidth * 0.3, video.videoWidth * 0.035);
  const padY = Math.max(handHeight * 0.3, video.videoHeight * 0.035);
  const left = Math.max(0, Math.min(...xs) - padX);
  const top = Math.max(0, Math.min(...ys) - padY);
  const right = Math.min(video.videoWidth, Math.max(...xs) + padX);
  const bottom = Math.min(video.videoHeight, Math.max(...ys) + padY);
  const cropWidth = right - left;
  const cropHeight = bottom - top;
  if (cropWidth < 2 || cropHeight < 2) throw new Error('Could not find a clear hand crop. Try again.');

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = Math.round(600 * cropHeight / cropWidth);
  const context = canvas.getContext('2d');
  context.setTransform(-1, 0, 0, 1, canvas.width, 0);
  context.drawImage(video, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  const photo = canvas.toDataURL('image/jpeg', 0.9);

  const dots = document.createElement('canvas');
  dots.width = canvas.width;
  dots.height = canvas.height;
  const dotContext = dots.getContext('2d');
  dotContext.fillStyle = '#4fd1c5';
  const radius = Math.max(3, dots.width * 0.008);
  landmarks.forEach((point) => {
    const x = ((right - point.x * video.videoWidth) / cropWidth) * dots.width;
    const y = ((point.y * video.videoHeight - top) / cropHeight) * dots.height;
    dotContext.beginPath();
    dotContext.arc(x, y, radius, 0, Math.PI * 2);
    dotContext.fill();
  });
  return { photo, skeleton: dots.toDataURL('image/png'), capturedAt: new Date().toISOString() };
}

export default function Calibrate() {
  const dataset = useDataset();
  const [selected, setSelected] = useState(NOTE_SIGN_MAP[0]);
  const [showRaw, setShowRaw] = useState(true);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captured, setCaptured] = useState(0);
  const [message, setMessage] = useState('');
  const [referenceImage, setReferenceImage] = useState(null);
  const [showReferenceSkeleton, setShowReferenceSkeleton] = useState(false);
  const [flip, setFlip] = useState(() => localStorage.getItem('gesturemusic.flipHandedness') === 'true');
  const tracker = useWebcam(true, flip);
  const timerRef = useRef(0);
  const recordingStart = useRef(0);
  const captureCount = useRef(0);
  const sampleBuffer = useRef([]);
  const classSamples = useMemo(() => Object.fromEntries(NOTE_SIGN_MAP.map((item) => [item.note[0], dataset.samples.filter((sample) => sample.label === item.note[0]).length])), [dataset.samples]);
  const evaluation = useMemo(() => evaluateSamples(dataset.samples), [dataset.samples]);

  useEffect(() => () => window.clearInterval(timerRef.current), []);
  useEffect(() => {
    let active = true;
    setReferenceImage(null);
    setShowReferenceSkeleton(false);
    loadReferenceImage(selected.note[0]).then((image) => {
      if (active) setReferenceImage(image);
    }).catch((error) => {
      if (active) setMessage(`Could not load your saved reference: ${error.message}`);
    });
    return () => { active = false; };
  }, [selected.note]);

  const captureReference = async () => {
    const hand = tracker.latestRef.current;
    try {
      const image = captureCroppedReference(tracker.videoRef.current, hand?.averageLandmarks || hand?.landmarks);
      await saveReferenceImage(selected.note[0], image);
      setReferenceImage(image);
      setShowReferenceSkeleton(false);
      setMessage(`${selected.solfege} reference captured and saved in this browser.`);
    } catch (error) {
      setMessage(error.message || 'Could not capture the camera reference.');
    }
  };
  const startRecording = () => {
    if (!tracker.latestRef.current?.features) { setMessage('Start the camera and show a clear hand sign first.'); return; }
    setCaptured(0); captureCount.current = 0;
    sampleBuffer.current = [...dataset.personal];
    setProgress(0); setRecording(true); setMessage('Recording samples. Vary distance and small angles while holding the selected sign.');
    recordingStart.current = performance.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - recordingStart.current;
      const hand = tracker.latestRef.current;
      if (hand?.features && captureCount.current < RECORD_SAMPLE_COUNT) {
        const group = crypto.randomUUID();
        sampleBuffer.current.push({ label: selected.note[0], group, features: Float32Array.from(hand.features), source: 'personal', handedness: hand.handedness });
        sampleBuffer.current.push({ label: selected.note[0], group, features: augmentFeatures(hand.features, { scale: (Math.random() - 0.5) * 0.04, angle: (Math.random() * 2 - 1) * (8 * Math.PI / 180), noise: 0.01 }), source: 'augmented', handedness: hand.handedness });
        captureCount.current += 1;
        if (captureCount.current % 5 === 0 || captureCount.current === RECORD_SAMPLE_COUNT) setCaptured(captureCount.current);
      }
      setProgress(Math.min(1, elapsed / RECORD_DURATION_MS));
      if (elapsed >= RECORD_DURATION_MS || captureCount.current >= RECORD_SAMPLE_COUNT) {
        window.clearInterval(timerRef.current); setRecording(false); setProgress(1);
        const completedCount = captureCount.current;
        void dataset.replacePersonal([...sampleBuffer.current]).then(() => {
          setMessage(completedCount >= RECORD_SAMPLE_COUNT ? 'Capture complete. Repeat for each sign, with the whole hand and wrist in frame.' : `Capture ended with ${completedCount} frames. Improve lighting or keep the hand visible, then record again.`);
        }).catch((error) => setMessage(`Could not save samples locally: ${error.message}`));
      }
    }, Math.floor(RECORD_DURATION_MS / RECORD_SAMPLE_COUNT));
  };

  const deleteSign = async () => {
    await dataset.replacePersonal(dataset.personal.filter((sample) => sample.label !== selected.note[0]));
    setMessage(`${selected.solfege} samples deleted.`);
  };
  const clearAll = async () => {
    await dataset.replacePersonal([]);
    setMessage('Personal samples cleared. Bundled default samples are unchanged.');
  };
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const incoming = await importSamples(file);
      await dataset.replacePersonal([...dataset.personal, ...incoming]);
      setMessage(`Imported ${incoming.length} samples.`);
    } catch (error) { setMessage(`Import failed: ${error.message}`); }
    event.target.value = '';
  };
  const toggleFlip = (value) => { setFlip(value); localStorage.setItem('gesturemusic.flipHandedness', String(value)); };

  return <main className="page page-calibrate">
    <div className="page-heading"><div><span className="eyebrow">PERSONALIZE RECOGNITION</span><h1>Calibrate</h1></div><p>Record your camera-friendly signs. Samples stay in this browser.</p></div>
    <div className="calibrate-layout">
      <div className="calibrate-camera"><WebcamPanel tracker={tracker} showRaw={showRaw} onToggleRaw={setShowRaw} /><div className="handedness-check glass"><div><span className="micro-label">HANDEDNESS SELF-CHECK</span><p>Raise your RIGHT hand: detected label is <b>{tracker.hand?.handedness || '—'}</b></p></div><label className="toggle-label"><input type="checkbox" checked={flip} onChange={(e) => toggleFlip(e.target.checked)} /><span>Flip label</span></label></div></div>
      <section className="glass calibrate-card">
        <div className="calibrate-top"><div><span className="eyebrow">TRAINING SET</span><h2>Record a sign</h2></div><span className="sample-total">{dataset.samples.length}<small> samples</small></span></div>
        <div className="calibrate-keys">{NOTE_SIGN_MAP.map((item) => <NoteKey key={item.note} item={item} active={selected.note === item.note} onClick={() => setSelected(item)} />)}</div>
        <div className="selected-sign"><div className="sign-preview"><b>{selected.note[0]}</b><small>{selected.solfege}</small></div><div><strong>{selected.signName}</strong><p>{selected.cameraVariant}</p></div><span className="sample-count">{classSamples[selected.note[0]]} samples</span></div>
        <div className="calibration-reference-pair">
          <div className="calibration-reference"><span className="micro-label">TRADITIONAL SIGN</span><SignPhoto item={selected} compact /></div>
          <div className="calibration-reference"><span className="micro-label">YOUR CAMERA VIEW</span>{referenceImage ? <div className="sign-photo-frame sign-photo-frame--compact"><img className="sign-photo" src={showReferenceSkeleton ? referenceImage.skeleton : referenceImage.photo} alt={showReferenceSkeleton ? `Average landmark dot skeleton for ${selected.solfege}` : `Your captured ${selected.solfege} hand sign`} /></div> : <div className="reference-empty">Capture your sign to save a cropped camera reference.</div>}</div>
        </div>
        {referenceImage && <><label className="toggle-label skeleton-toggle"><input type="checkbox" checked={showReferenceSkeleton} onChange={(event) => setShowReferenceSkeleton(event.target.checked)} /><span>Show average-landmark dot skeleton</span></label><p className="skeleton-caption">Dots are averaged across recent tracked frames. The camera photo remains saved separately.</p></>}
        <div className="record-meter"><div className="calibration-progress-ring"><svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="23"/><circle className="calibration-ring-progress" cx="28" cy="28" r="23" strokeDasharray={2 * Math.PI * 23} strokeDashoffset={2 * Math.PI * 23 * (1 - progress)} /></svg><span>{Math.round(progress * 100)}%</span></div><span>{recording ? `${captured} / ${RECORD_SAMPLE_COUNT} frames` : '10 seconds · 150 frames'}</span></div>
        <div className="calibrate-actions"><button className="button button--aqua" disabled={recording} onClick={captureReference}>Capture reference</button><button className="button button--quiet" disabled={recording} onClick={startRecording}>{recording ? 'Recording…' : '● Record samples'}</button><button className="button button--quiet" onClick={deleteSign}>Delete sign</button></div>
        {message && <p className="inline-message" role="status">{message}</p>}
        <div className="dataset-actions"><button className="text-button" onClick={() => exportSamples(dataset.personal)}>Export JSON ↓</button><label className="text-button import-button">Import JSON ↑<input type="file" accept="application/json,.json" onChange={handleImport} /></label><button className="text-button text-danger" onClick={clearAll}>Clear personal samples</button></div>
      </section>
    </div>
    <section className="evaluation-section glass"><div className="evaluation-heading"><div><span className="eyebrow">MODEL CHECK</span><h2>5-fold evaluation</h2><p className="coverage-line">Sign coverage: {evaluation.covered} / 7</p></div><div className="accuracy-score">{evaluation.accuracy === null ? '—' : `${Math.round(evaluation.accuracy * 100)}%`}<small>{evaluation.total ? `${evaluation.correct} / ${evaluation.total} correct` : 'not enough samples yet'}</small></div></div><ConfusionMatrix result={evaluation} /><p className="evaluation-note">Cross-validation uses samples recorded in this browser and the bundled dataset. This score estimates performance on the collected samples; it is not a guarantee for new lighting or camera conditions.</p></section>
  </main>;
}
