import { useCallback, useEffect, useRef, useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import AnalysisStatus from '../components/AnalysisStatus';
import SignPlayer from '../components/SignPlayer';
import NoteTimeline from '../components/NoteTimeline';
import TransportBar from '../components/TransportBar';
import ResultsSummary from '../components/ResultsSummary';
import { useAnalysis } from '../hooks/useAnalysis';
import { usePlayback } from '../hooks/usePlayback';

function checkDuration(file) {
  return new Promise((resolve, reject) => {
    const url=URL.createObjectURL(file), audio=new Audio();
    audio.onloadedmetadata=()=>{const d=audio.duration;URL.revokeObjectURL(url);d>60?reject(new Error('Recordings must be 60 seconds or shorter.')):resolve();};
    audio.onerror=()=>{URL.revokeObjectURL(url);resolve();};audio.src=url;
  });
}

export default function Analyze() {
  const {status,result,error,analyze,cancel,clear}=useAnalysis();
  const [file,setFile]=useState(null),[objectUrl,setObjectUrl]=useState(''),[engine,setEngine]=useState('pyin'),[transpose,setTranspose]=useState(0),[autoTranspose,setAutoTranspose]=useState(false),[optionsOpen,setOptionsOpen]=useState(false),[localError,setLocalError]=useState('');
  const busy=status==='analyzing';
  const run=useCallback(async(nextFile,opts={})=>{
    setLocalError('');
    try{await checkDuration(nextFile);}catch(e){setLocalError(e.message);return;}
    const url=URL.createObjectURL(nextFile);setObjectUrl(old=>{if(old)URL.revokeObjectURL(old);return url;});setFile(nextFile);
    await analyze(nextFile,{engine,transpose,autoTranspose,...opts});
  },[analyze,autoTranspose,engine,transpose]);
  const playback=usePlayback(result?.notes||[],result?.meta.duration_s||0,objectUrl);
  const readyRef=useRef(false);readyRef.current=Boolean(result);
  useEffect(()=>{
    const onKey=e=>{if(!readyRef.current||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;const p=playbackRef.current;if(e.code==='Space'){e.preventDefault();p.playing?p.pause():p.play();}else if(e.key==='ArrowLeft')p.seek(p.time-2);else if(e.key==='ArrowRight')p.seek(p.time+2);else if(['1','2','3'].includes(e.key))p.setSpeed([.5,.75,1][Number(e.key)-1]);};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  const playbackRef=useRef(playback);playbackRef.current=playback;
  useEffect(()=>()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);},[objectUrl]);
  const duration=result?.meta.duration_s||0;
  const onTranspose=delta=>{setTranspose(delta);if(file)run(file,{transpose:delta,autoTranspose:false});};
  const statusError=localError||error;
  return <main className="page page-analyze">
    <div className="page-heading page-heading--compact"><div><span className="eyebrow">AUDIO → NOTES → HAND SIGNS</span><h1>Analyze <em>a melody</em></h1></div><p>Upload a single melodic line and follow each detected Kodály sign in time. Audio is processed temporarily and discarded.</p></div>
    <UploadDropzone busy={busy} onFile={f=>run(f)} />
    <div className="analyze-options glass"><button className="text-button" onClick={()=>setOptionsOpen(v=>!v)}>{optionsOpen?'Hide':'Analysis options'} {optionsOpen?'−':'+'}</button>{optionsOpen&&<div className="options-row"><label>Engine <select value={engine} onChange={e=>setEngine(e.target.value)}><option value="pyin">pyin · recommended</option></select></label><label className="toggle-label"><input type="checkbox" checked={autoTranspose} onChange={e=>setAutoTranspose(e.target.checked)} />Auto-transpose to C major</label><label>Manual transpose <button className="stepper" onClick={()=>setTranspose(v=>Math.max(-12,v-1))}>−</button><output>{transpose>0?'+':''}{transpose}</output><button className="stepper" onClick={()=>setTranspose(v=>Math.min(12,v+1))}>+</button></label><button className="button button--quiet" disabled={!file||busy} onClick={()=>run(file)}>Re-analyze</button></div>}</div>
    <AnalysisStatus busy={busy} error={statusError} cancel={()=>{cancel();setLocalError('');}} />
    {result&&<><ResultsSummary result={result} onTranspose={onTranspose}/><div className="analysis-workspace"><SignPlayer notes={result.notes} index={playback.currentIndex} time={playback.time}/><div className="analysis-main"><TransportBar playback={playback} duration={duration}/><NoteTimeline notes={result.notes} duration={duration} time={playback.time} seek={playback.seek}/><p className="shortcut-hint">Space play/pause · ← / → seek 2s · 1 / 2 / 3 speed</p></div></div></>}
    {file&&result&&<button className="text-button" onClick={()=>{clear();setFile(null);setObjectUrl(old=>{if(old)URL.revokeObjectURL(old);return'';});}}>Clear analysis</button>}
    <p className="analysis-note">This prototype targets monophonic audio. Chords, polyphonic instruments, and notes outside C2–C7 may reduce accuracy. Natural notes map to the seven signs; accidentals are shown without a sign.</p>
  </main>;
}
