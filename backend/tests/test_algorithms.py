import numpy as np

from app.services.pitch_engines.base import PitchTrack
from app.services.segmentation import segment_track
from app.services.transpose import suggest_transpose
from app.services.quality import quality_warnings
from app.services.tuning import estimate_tuning


def track(pitches, probability=None):
    midi = np.repeat(np.asarray(pitches,dtype=float), 5)
    voiced = np.isfinite(midi)
    return PitchTrack(midi,voiced,np.ones_like(midi) if probability is None else np.repeat(probability,5),512,22050)


def test_pitch_plateaus_form_notes():
    result=segment_track(track([60]*8+[62]*8+[64]*8))
    assert [x['midi'] for x in result] == [60,62,64]


def test_transpose_d_major_down_two():
    assert suggest_transpose([62,64,66,67,69,71,73]) == -2


def test_tuning_refines_twenty_cent_offset():
    time=np.arange(22050)/22050
    audio=np.sin(2*np.pi*440*time).astype(np.float32)
    cents, semitones=estimate_tuning(audio,22050,512,np.array([60.2,62.2,64.2,67.2]))
    assert abs(cents-20)<1e-6
    assert abs(semitones-.2)<1e-6


def test_repeated_same_pitch_splits_at_onset():
    result=segment_track(track([60]*20),onset_frames={10})
    assert [x['midi'] for x in result] == [60,60]


def test_vibrato_does_not_split_note():
    values=[60.0,60.35,59.8,60.25,59.75,60.3]*5
    result=segment_track(track(values))
    assert len(result)==1


def test_median_filter_removes_one_frame_pitch_glitch():
    values=np.array([60]*8+[67]+[60]*8,dtype=float)
    voiced=np.ones(len(values),dtype=bool)
    result=segment_track(PitchTrack(values,voiced,np.ones_like(values),512,22050))
    assert [x['midi'] for x in result] == [60]


def test_brief_octave_flip_is_repaired():
    values=np.array([60]*10+[72]*2+[60]*10,dtype=float)
    voiced=np.ones(len(values),dtype=bool)
    result=segment_track(PitchTrack(values,voiced,np.ones_like(values),512,22050))
    assert [x['midi'] for x in result] == [60]


def test_short_pitch_plateau_is_dropped():
    values=np.array([60]*10+[62]*3+[60]*10,dtype=float)
    voiced=np.ones(len(values),dtype=bool)
    result=segment_track(PitchTrack(values,voiced,np.ones_like(values),512,22050))
    assert all(x['midi']==60 for x in result)


def test_accidentals_are_marked():
    result=segment_track(track([61]*10+[64]*10))
    assert result[0]['is_natural'] is False
    assert result[1]['is_natural'] is True


def test_quality_warnings_report_low_voicing_and_accidentals():
    warnings=quality_warnings(.2,[{'is_natural':False,'start_s':0}],np.array([.2,.3]))
    assert {'LOW_VOICING','FEW_NOTES','MANY_ACCIDENTALS'} <= {w['code'] for w in warnings}
