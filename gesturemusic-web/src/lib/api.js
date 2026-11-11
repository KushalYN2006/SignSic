const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: 'This file is over the 20 MB limit.',
  UNSUPPORTED_FORMAT: 'Choose a WAV, MP3, M4A, OGG, or FLAC file.',
  AUDIO_TOO_LONG: 'This recording is longer than 60 seconds.',
  AUDIO_UNREADABLE: 'The audio could not be decoded. Check the file and try again.',
  NO_NOTES_FOUND: 'No stable notes were detected. Try a clearer recording.',
  ANALYSIS_TIMEOUT: 'Analysis took too long. Try a shorter recording.',
  ENGINE_UNAVAILABLE: 'The pitch-analysis engine could not start. Check the backend environment and restart the FastAPI server.',
};

export async function analyzeAudio(file, options = {}, signal) {
  const form = new FormData();
  form.append('file', file);
  form.append('engine', options.engine || 'pyin');
  form.append('transpose', String(options.transpose || 0));
  form.append('auto_transpose', String(Boolean(options.autoTranspose)));
  let response;
  try {
    response = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: form, signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Backend not reachable. Start the FastAPI server and retry.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body?.error?.code || body?.detail?.error?.code;
    throw new Error(ERROR_MESSAGES[code] || body?.error?.message || body?.detail?.error?.message || 'Analysis failed. Please retry.');
  }
  return body;
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error('Backend not reachable. Start the FastAPI server to analyze audio.');
  return response.json();
}
