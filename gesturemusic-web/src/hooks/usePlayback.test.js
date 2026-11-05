import { describe, expect, it } from 'vitest';
import { activeNoteIndex } from './usePlayback';

const notes = [{ start_s: 1, end_s: 2 }, { start_s: 3, end_s: 4 }];

describe('activeNoteIndex', () => {
  it('returns no note before the first note', () => expect(activeNoteIndex(notes, 0)).toBe(-1));
  it('uses half-open note intervals and detects rests', () => {
    expect(activeNoteIndex(notes, 1)).toBe(0);
    expect(activeNoteIndex(notes, 2)).toBe(-1);
    expect(activeNoteIndex(notes, 3)).toBe(1);
  });
  it('returns no note after the sequence', () => expect(activeNoteIndex(notes, 5)).toBe(-1));
});
