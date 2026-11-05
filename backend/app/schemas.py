from pydantic import BaseModel, Field


class ApiError(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ApiError


class AnalysisMeta(BaseModel):
    duration_s: float
    sample_rate: int
    engine: str
    tuning_cents: float
    voiced_ratio: float
    transpose_semitones: int
    processing_ms: int


class NoteEvent(BaseModel):
    id: int
    note: str
    pitch_class: str
    octave: int
    midi: int
    start_s: float
    end_s: float
    duration_s: float
    confidence: float
    is_natural: bool


class AnalysisSummary(BaseModel):
    note_count: int
    natural_count: int
    accidental_count: int
    sign_coverage: float
    octave_range: list[int] | None
    suggested_transpose: int


class AnalysisWarning(BaseModel):
    code: str
    message: str


class AnalysisResponse(BaseModel):
    meta: AnalysisMeta
    notes: list[NoteEvent]
    summary: AnalysisSummary
    warnings: list[AnalysisWarning] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    version: str
    engines: list[str]
