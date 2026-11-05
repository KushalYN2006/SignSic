import { describe, expect, it } from 'vitest';
import { exportSolfege, noteToSign } from './noteToSign';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';

describe('noteToSign', () => {
  it('maps all seven natural pitch classes to the shared sign map', () => {
    for (const item of NOTE_SIGN_MAP) expect(noteToSign({ pitch_class: item.note[0] })).toBe(item);
  });
  it('does not assign signs to accidentals', () => {
    expect(noteToSign({ pitch_class: 'C#' })).toBeNull();
    expect(noteToSign({ note: 'Bb4' })).toBeNull();
  });
  it('exports solfege as a readable sequence', () => {
    expect(exportSolfege([{ pitch_class: 'C' }, { pitch_class: 'D' }, { pitch_class: 'F#' }])).toBe('Do Re F# (no sign in v1)');
  });
});
