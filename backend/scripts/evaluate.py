"""Evaluate sample note events with mir_eval note-level onset/pitch metrics."""
import json
from pathlib import Path
import sys

import librosa
import mir_eval
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.services.audio_loader import load_audio
from app.services.pitch_engines.pyin_engine import PyinEngine
from app.services.segmentation import repeated_note_onsets, segment_track
from app.services.tuning import estimate_tuning


def main():
    rows=[]
    print(f"Evaluator: librosa {librosa.__version__}", flush=True)
    for truth_path in sorted((ROOT/'samples').glob('*.json')):
        audio_path=truth_path.with_suffix('.wav')
        truth=json.loads(truth_path.read_text(encoding='utf-8'))
        audio,_,offset,_=load_audio(audio_path)
        track=PyinEngine().track(audio,22050)
        cents,semitones=estimate_tuning(audio,22050,track.hop_length,track.midi[track.voiced]);track.midi[track.voiced]-=semitones
        candidates=librosa.onset.onset_detect(y=audio,sr=22050,hop_length=track.hop_length,backtrack=False,units='frames')
        onset_frames=repeated_note_onsets(audio,candidates,22050,track.hop_length)
        predicted=segment_track(track,offset,onset_frames)
        ref_intervals=np.array([[n['start_s'],n['end_s']] for n in truth])
        ref_pitches=np.array([n['midi'] for n in truth],dtype=float)
        est_intervals=np.array([[n['start_s'],n['end_s']] for n in predicted]).reshape((-1,2))
        est_pitches=np.array([n['midi'] for n in predicted],dtype=float)
        if len(est_pitches):
            precision,recall,f1,_=mir_eval.transcription.precision_recall_f1_overlap(ref_intervals,ref_pitches,est_intervals,est_pitches,offset_ratio=None)
        else: precision=recall=f1=0.0
        rows.append({'sample':truth_path.stem,'reference_notes':len(truth),'detected_notes':len(predicted),'precision':round(float(precision),3),'recall':round(float(recall),3),'f1':round(float(f1),3),'tuning_cents':round(cents,1)})
        print(f"{truth_path.stem}: precision={precision:.3f} recall={recall:.3f} f1={f1:.3f}", flush=True)
    print('sample                 ref  got  precision  recall  F1')
    for r in rows:print(f"{r['sample']:<22} {r['reference_notes']:>3}  {r['detected_notes']:>3}  {r['precision']:>9.3f}  {r['recall']:>6.3f}  {r['f1']:>5.3f}")
    (ROOT/'evaluation.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')


if __name__=='__main__':main()
