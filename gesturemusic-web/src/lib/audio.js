import * as Tone from 'tone';

let synth;
let started = false;

export async function startAudio() {
  if (!started) {
    await Tone.start();
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.015, decay: 0.08, sustain: 0.35, release: 0.25 },
    }).toDestination();
    started = true;
  }
}

export async function playNote(note, velocity = 0.65, duration = 0.5) {
  await startAudio();
  synth.triggerAttackRelease(note, duration, undefined, Math.min(1, Math.max(0.05, velocity)));
}

export function disposeAudio() {
  synth?.dispose();
  synth = undefined;
  started = false;
}
