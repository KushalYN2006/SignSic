const makeNote = (note, solfege, midi, signName, description, cameraVariant, commonConfusions) => ({
  note,
  solfege,
  midi,
  frequency: 440 * 2 ** ((midi - 69) / 12),
  signName,
  description,
  cameraVariant,
  commonConfusions,
  howTo: cameraVariant,
});

export const NOTE_SIGN_MAP = [
  makeNote('C4', 'Do', 60, 'Loose fist', 'Curl the fingers loosely into the palm with the thumb resting across them.', 'Hold a relaxed fist with the back of the hand facing the camera.', ['Fa']),
  makeNote('D4', 'Re', 62, 'Upward flat hand', 'Keep the fingers together and angle the flat hand upward.', 'Show the back of the hand; point the joined fingers about 45 degrees up in the image.', ['Mi']),
  makeNote('E4', 'Mi', 64, 'Level flat hand', 'Hold the flat hand level, with the fingers together and pointing straight ahead.', 'Keep the hand flat and level, with joined fingers held horizontally.', ['Re', 'La', 'Sol']),
  makeNote('F4', 'Fa', 65, 'Thumb-down fist', 'Make a loose fist and extend the thumb downward.', 'Face the back of the loose fist toward the camera, thumb straight down.', ['Do']),
  makeNote('G4', 'Sol', 67, 'Palm toward the signer', 'Hold the hand upright with the fingers together and the palm facing the signer.', 'Keep the fingers joined and turn the palm toward yourself, the signer.', ['Mi']),
  makeNote('A4', 'La', 69, 'Relaxed curved hand', 'Keep the hand relaxed and curved, with the fingertips drooping toward the floor.', 'Let the relaxed, curved fingers droop; keep the whole hand visible.', ['Mi', 'Sol']),
  makeNote('B4', 'Ti', 71, 'Index-pointing hand', 'Point the index finger upward while curling the other fingers.', 'Point one index finger straight up; keep the other fingers curled.', ['Do']),
];

export const NOTE_BY_LETTER = Object.fromEntries(NOTE_SIGN_MAP.map((item) => [item.note[0], item]));
export const NOTE_BY_NAME = Object.fromEntries(NOTE_SIGN_MAP.map((item) => [item.note, item]));
