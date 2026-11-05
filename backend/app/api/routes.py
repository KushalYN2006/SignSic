import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
from pathlib import Path
import tempfile
import time

import librosa
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.config import ALLOWED_EXTENSIONS, ANALYSIS_TIMEOUT_S, MAX_UPLOAD_BYTES, SAMPLE_RATE, VERSION
from app.schemas import AnalysisResponse, ErrorResponse, HealthResponse
from app.services.audio_loader import AudioLoadError, load_audio
from app.services.pitch_engines.pyin_engine import PyinEngine
from app.services.quality import quality_warnings
from app.services.segmentation import repeated_note_onsets, segment_track
from app.services.transpose import suggest_transpose, transpose_notes
from app.services.tuning import estimate_tuning

router = APIRouter(prefix="/api")
executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="gesturemusic-analysis")
logger = logging.getLogger("gesturemusic.analysis")


def error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})


async def _read_limited(upload: UploadFile) -> bytes:
    content = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise error(413, "FILE_TOO_LARGE", "Upload must be 20 MB or smaller.")
    return content


def _analyze(path: str, engine: str, transpose: int, auto_transpose: bool) -> dict:
    audio, duration, offset, clipped = load_audio(path)
    track = PyinEngine().track(audio, SAMPLE_RATE)
    tuning_cents, tuning_semitones = estimate_tuning(audio, SAMPLE_RATE, track.hop_length, track.midi[track.voiced])
    track.midi[track.voiced] -= tuning_semitones
    detected = librosa.onset.onset_detect(y=audio, sr=SAMPLE_RATE, hop_length=track.hop_length, backtrack=False, units="frames")
    onset_frames = repeated_note_onsets(audio, detected, SAMPLE_RATE, track.hop_length)
    notes = segment_track(track, offset, onset_frames)
    if not notes:
        raise error(422, "NO_NOTES_FOUND", "No stable notes were detected. Try a louder, cleaner monophonic recording.")
    suggested = suggest_transpose([n["midi"] for n in notes])
    shift = suggested if auto_transpose else transpose
    notes = transpose_notes(notes, shift)
    for idx, note in enumerate(notes):
        note["id"] = idx
    natural = sum(n["is_natural"] for n in notes)
    probabilities = track.probability[track.voiced]
    warnings = quality_warnings(float(np.mean(track.voiced)), notes, probabilities, clipped)
    octaves = [n["octave"] for n in notes]
    return {
        "meta": {"duration_s": round(duration, 3), "sample_rate": SAMPLE_RATE, "engine": engine,
                 "tuning_cents": round(tuning_cents, 1), "voiced_ratio": round(float(np.mean(track.voiced)), 3),
                 "transpose_semitones": shift, "processing_ms": 0},
        "notes": notes,
        "summary": {"note_count": len(notes), "natural_count": natural, "accidental_count": len(notes)-natural,
                    "sign_coverage": round(natural / len(notes), 3), "octave_range": [min(octaves), max(octaves)],
                    "suggested_transpose": suggested},
        "warnings": warnings,
    }


def _analyze_and_remove(path: str, engine: str, transpose: int, auto_transpose: bool) -> dict:
    try:
        return _analyze(path, engine, transpose, auto_transpose)
    finally:
        Path(path).unlink(missing_ok=True)


@router.get("/health", response_model=HealthResponse)
async def health():
    return {"status": "ok", "version": VERSION, "engines": ["pyin"]}


@router.post("/analyze", response_model=AnalysisResponse,
             responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse},
                        422: {"model": ErrorResponse}, 504: {"model": ErrorResponse}})
async def analyze(file: UploadFile = File(...), engine: str = Form("pyin"), transpose: int = Form(0),
                  auto_transpose: bool = Form(False)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise error(415, "UNSUPPORTED_FORMAT", "Choose a WAV, MP3, M4A, OGG, or FLAC audio file.")
    if engine != "pyin":
        raise error(422, "ENGINE_UNAVAILABLE", "Only the pyin engine is enabled in this version.")
    content = await _read_limited(file)
    start = time.perf_counter()
    temp_path = None
    worker_owns_file = False
    try:
        with tempfile.NamedTemporaryFile(prefix="gesturemusic-", suffix=suffix, delete=False) as temp:
            temp.write(content)
            temp_path = temp.name
        try:
            worker = asyncio.get_running_loop().run_in_executor(
                executor, _analyze_and_remove, temp_path, engine, transpose, auto_transpose)
            worker_owns_file = True
            result = await asyncio.wait_for(worker, timeout=ANALYSIS_TIMEOUT_S)
        except asyncio.TimeoutError as exc:
            raise error(504, "ANALYSIS_TIMEOUT", "Analysis took too long. Try a shorter or simpler recording.") from exc
        except AudioLoadError as exc:
            code = "AUDIO_TOO_LONG" if "60 second" in str(exc) else "AUDIO_UNREADABLE"
            raise error(422, code, str(exc)) from exc
        result["meta"]["processing_ms"] = round((time.perf_counter() - start) * 1000)
        logger.info("analysis_complete bytes=%d duration_s=%.3f processing_ms=%d", len(content), result["meta"]["duration_s"], result["meta"]["processing_ms"])
        return result
    finally:
        if temp_path and not worker_owns_file:
            Path(temp_path).unlink(missing_ok=True)
        await file.close()
