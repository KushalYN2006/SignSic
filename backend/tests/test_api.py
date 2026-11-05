import asyncio
from io import BytesIO
from pathlib import Path
from fastapi import HTTPException, UploadFile
import numpy as np
import soundfile as sf

from app.api.routes import analyze, health

def test_health():
    response=asyncio.run(health())
    assert response['engines']==['pyin']


def test_wrong_extension():
    upload=UploadFile(filename='sound.txt',file=BytesIO(b'hello'))
    try:
        asyncio.run(analyze(file=upload,engine='pyin',transpose=0,auto_transpose=False))
    except HTTPException as exc:
        assert exc.status_code==415
        assert exc.detail['error']['code']=='UNSUPPORTED_FORMAT'
    else:
        raise AssertionError('wrong file type was accepted')


def test_corrupt_audio_has_named_error_and_no_temp_file(tmp_path,monkeypatch):
    import app.api.routes as routes
    monkeypatch.setattr(routes.tempfile,'tempdir',str(tmp_path))
    upload=UploadFile(filename='corrupt.wav',file=BytesIO(b'not audio'))
    try:
        asyncio.run(analyze(file=upload,engine='pyin',transpose=0,auto_transpose=False))
    except HTTPException as exc:
        assert exc.status_code==422
        assert exc.detail['error']['code']=='AUDIO_UNREADABLE'
    else:
        raise AssertionError('corrupt audio was accepted')
    assert list(tmp_path.iterdir())==[]


def test_valid_sample_returns_note_schema_and_discards_temp_file(tmp_path,monkeypatch):
    import app.api.routes as routes
    monkeypatch.setattr(routes.tempfile,'tempdir',str(tmp_path))
    sample=Path(__file__).resolve().parents[1]/'samples'/'scale.wav'
    upload=UploadFile(filename='scale.wav',file=BytesIO(sample.read_bytes()))
    result=asyncio.run(analyze(file=upload,engine='pyin',transpose=0,auto_transpose=False))
    assert result['notes']
    assert {'note','pitch_class','octave','midi','start_s','end_s','confidence','is_natural'} <= result['notes'][0].keys()
    assert {'meta','summary','warnings'} <= result.keys()
    assert list(tmp_path.iterdir())==[]


def wav_upload(audio, name='test.wav'):
    buffer=BytesIO()
    sf.write(buffer,audio,22050,format='WAV')
    buffer.seek(0)
    return UploadFile(filename=name,file=buffer)


def test_audio_over_duration_limit_returns_named_error(tmp_path,monkeypatch):
    import app.api.routes as routes
    monkeypatch.setattr(routes.tempfile,'tempdir',str(tmp_path))
    upload=wav_upload(np.zeros(61*22050,dtype=np.float32),'long.wav')
    try:
        asyncio.run(analyze(file=upload,engine='pyin',transpose=0,auto_transpose=False))
    except HTTPException as exc:
        assert exc.status_code==422
        assert exc.detail['error']['code']=='AUDIO_TOO_LONG'
    else:
        raise AssertionError('audio over 60 seconds was accepted')
    assert list(tmp_path.iterdir())==[]


def test_silent_audio_returns_no_notes_error(tmp_path,monkeypatch):
    import app.api.routes as routes
    monkeypatch.setattr(routes.tempfile,'tempdir',str(tmp_path))
    upload=wav_upload(np.zeros(1*22050,dtype=np.float32),'silent.wav')
    try:
        asyncio.run(analyze(file=upload,engine='pyin',transpose=0,auto_transpose=False))
    except HTTPException as exc:
        assert exc.status_code==422
        assert exc.detail['error']['code']=='NO_NOTES_FOUND'
    else:
        raise AssertionError('silent audio was accepted')
    assert list(tmp_path.iterdir())==[]


def test_oversize_upload_returns_named_error():
    upload=UploadFile(filename='large.wav',file=BytesIO(b'x'*(20*1024*1024+1)))
    try:
        asyncio.run(analyze(file=upload,engine='pyin',transpose=0,auto_transpose=False))
    except HTTPException as exc:
        assert exc.status_code==413
        assert exc.detail['error']['code']=='FILE_TOO_LARGE'
    else:
        raise AssertionError('oversize upload was accepted')
