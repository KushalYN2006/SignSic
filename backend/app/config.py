import os

SAMPLE_RATE = 22050
FRAME_LENGTH = int(os.getenv("GESTUREMUSIC_FRAME_LENGTH", "2048"))
HOP_LENGTH = int(os.getenv("GESTUREMUSIC_HOP_LENGTH", "512"))
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_DURATION_S = 60.0
ANALYSIS_TIMEOUT_S = float(os.getenv("GESTUREMUSIC_ANALYSIS_TIMEOUT", "45"))
MIN_NOTE_MS = 80
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac"}
CORS_ORIGINS = [v.strip() for v in os.getenv("GESTUREMUSIC_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if v.strip()]
VERSION = "2.0.0"
