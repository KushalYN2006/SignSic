import { NOTE_BY_LETTER } from '../data/noteSignMap';

export function noteToSign(note) {
  const pitchClass = note?.pitch_class || (/^([A-G](?:#|b)?)/.exec(note?.note || '')?.[1] ?? '');
  if (pitchClass.length !== 1) return null;
  return NOTE_BY_LETTER[pitchClass] || null;
}

export function exportSolfege(notes) {
  return notes.map((note) => noteToSign(note)?.solfege || `${note.pitch_class || note.note} (no sign in v1)`).join(' ');
}
