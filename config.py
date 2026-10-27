APP_NAME = "Hand Sign to Musical Note Generator"
HAND_LANDMARKER_MODEL = "models/hand_landmarker.task"
SOUNDFONT_PATH = "assets/soundfonts/FluidR3_GM.sf2"

CAMERA_INDEX = 0
FRAME_WIDTH = 960
FRAME_HEIGHT = 540
TIMER_INTERVAL_MS = 30

MIN_PINCH_DISTANCE = 20.0
MAX_PINCH_DISTANCE = 250.0
NOTE_COOLDOWN_SECONDS = 0.18
BUCKET_HYSTERESIS = 0.08
DEFAULT_NOTE_DURATION = 0.30
HAND_VOLUME_DEFAULT = 0.45
HAND_VOLUME_MIN = 0.05
HAND_VOLUME_MAX = 1.0
HAND_VOLUME_DRAG_SENSITIVITY = 1.8

SAMPLE_RATE = 44100
MAX_POLYPHONY = 16
ATTACK_SECONDS = 0.008
RELEASE_SECONDS = 0.035

FM_MOD_RATIO = 2.0
FM_MOD_INDEX = 3.5
AM_RATE = 7.0
DUO_DETUNE_CENTS = 4.0

SCALE_NOTES = [
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
    "A4",
    "B4",
    "C5",
    "D5",
    "E5",
    "F5",
    "G5",
    "A5",
    "B5",
    "C6",
]

SYNTH_INSTRUMENTS = ["synth", "fm", "am", "duo"]
SOUNDFONT_INSTRUMENTS = {
    "Piano": 0,
    "Violin": 40,
    "Guitar": 24,
    "Flute": 73,
    "Trumpet": 56,
}
SOUNDFONT_PROGRAM_CHANNELS = {
    0: 0,
    24: 1,
    40: 2,
    56: 3,
    73: 4,
}
