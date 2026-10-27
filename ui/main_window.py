from __future__ import annotations

import cv2
from threading import Thread
from PyQt5.QtCore import QTimer
from PyQt5.QtWidgets import (
    QButtonGroup,
    QCheckBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QRadioButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from config import APP_NAME, CAMERA_INDEX, FRAME_HEIGHT, FRAME_WIDTH, TIMER_INTERVAL_MS
from gesture_mapper import GestureMapper
from hand_tracker import HandTracker
from sequence_recorder import SequenceRecorder
from soundfont_engine import SoundFontEngine
from synth_engine import SynthEngine
from ui.styles import APP_QSS
from ui.video_widget import VideoWidget


INSTRUMENTS = ["off", "synth", "fm", "am", "duo", "Piano", "Violin", "Guitar", "Flute", "Trumpet"]


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.resize(1180, 760)
        self.setStyleSheet(APP_QSS)

        self.cap = cv2.VideoCapture(CAMERA_INDEX)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
        self.tracker = HandTracker()
        self.mapper = GestureMapper()
        self.synth = SynthEngine()
        self.soundfont = SoundFontEngine()
        self.recorder = SequenceRecorder()
        self.playing = False
        self.current_instruments = {"left": "off", "right": "off"}

        self.video = VideoWidget()
        self.show_raw = QCheckBox("Show raw webcam feed")
        self.show_raw.setChecked(True)
        self.show_log = QCheckBox("Show note events log")
        self.show_log.setChecked(True)
        self.left_velocity = QLabel("Left velocity: 57")
        self.left_velocity.setObjectName("hint")
        self.right_velocity = QLabel("Right velocity: 57")
        self.right_velocity.setObjectName("hint")
        self.log = QTextEdit()
        self.log.setReadOnly(True)

        self.left_group = self._instrument_group("Left Hand", "left", default="synth")
        self.right_group = self._instrument_group("Right Hand", "right", default="fm")

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)
        self._build_layout()

    def _build_layout(self) -> None:
        root = QWidget()
        outer = QVBoxLayout(root)
        main = QHBoxLayout()

        left = QVBoxLayout()
        left.addWidget(self.video, 1)
        hint = QLabel("Calibration: make a fist, then spread thumb and index fully.")
        hint.setObjectName("hint")
        left.addWidget(hint)
        left.addWidget(self.show_raw)
        main.addLayout(left, 2)

        right = QVBoxLayout()
        right.addWidget(self.left_group)
        right.addWidget(self.left_velocity)
        right.addWidget(self.right_group)
        right.addWidget(self.right_velocity)
        right.addWidget(self.show_log)
        right.addStretch(1)
        main.addLayout(right, 1)

        outer.addLayout(main, 1)
        outer.addWidget(self.log, 1)
        outer.addLayout(self._toolbar())
        self.setCentralWidget(root)

    def _instrument_group(self, title: str, hand: str, default: str) -> QGroupBox:
        box = QGroupBox(title)
        layout = QVBoxLayout(box)
        group = QButtonGroup(box)
        setattr(self, f"{hand}_buttons", group)
        for name in INSTRUMENTS:
            button = QRadioButton(name)
            button.setChecked(name == default)
            group.addButton(button)
            layout.addWidget(button)
        return box

    def _toolbar(self) -> QHBoxLayout:
        bar = QHBoxLayout()
        play = QPushButton("Play")
        play.setObjectName("primary")
        pause = QPushButton("Pause")
        delete = QPushButton("Delete Last")
        clear = QPushButton("Clear All")
        clear.setObjectName("danger")
        save = QPushButton("Save")
        load = QPushButton("Load + Replay")

        play.clicked.connect(self.play)
        pause.clicked.connect(self.pause)
        delete.clicked.connect(self.delete_last)
        clear.clicked.connect(self.clear_all)
        save.clicked.connect(self.save_sequence)
        load.clicked.connect(self.load_and_replay)

        for button in [play, pause, delete, clear, save, load]:
            bar.addWidget(button)
        bar.addStretch(1)
        return bar

    def play(self) -> None:
        try:
            self.synth.start()
        except Exception as exc:
            QMessageBox.warning(
                self,
                "Synth audio unavailable",
                f"Could not start synth audio output:\n{exc}\n\n"
                "Webcam tracking will continue. SoundFont instruments may still work "
                "if FluidSynth is installed.",
            )
            self._append_log(f"Synth audio unavailable: {exc}")
        self.mapper.reset_clock()
        self.playing = True
        self.timer.start(TIMER_INTERVAL_MS)
        self._append_log("Tracking started.")

    def pause(self) -> None:
        self.playing = False
        self.timer.stop()
        self.synth.stop()
        self.soundfont.stop_live("left")
        self.soundfont.stop_live("right")
        self.video.setText("Camera paused")
        self._append_log("Paused.")

    def _tick(self) -> None:
        ok, frame = self.cap.read()
        if not ok:
            self._append_log("Camera frame unavailable.")
            return
        frame = cv2.flip(cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT)), 1)
        hands = self.tracker.detect(frame)
        seen_hands: set[str] = set()
        for hand in hands:
            label = hand.label if hand.label in ("left", "right") else "right"
            seen_hands.add(label)
            instrument = self._instrument_for(label)
            if self.current_instruments[label] != instrument:
                self._stop_hand(label)
                self.current_instruments[label] = instrument
            event = self.mapper.update(
                label,
                hand.landmarks,
                (FRAME_WIDTH, FRAME_HEIGHT),
                instrument,
            )
            if event:
                self._play_event(event)
                self._update_velocity_label(label, event["velocity"])
                if event["note_changed"] and event["instrument"] != "off":
                    self.recorder.add(event)
                    self._append_event(event)
        for missing_hand in {"left", "right"} - seen_hands:
            self._stop_hand(missing_hand)
        self.video.show_frame(frame, hands, self.tracker.connections, self.show_raw.isChecked())

    def _instrument_for(self, hand: str) -> str:
        group = getattr(self, f"{hand}_buttons")
        checked = group.checkedButton()
        return checked.text() if checked else "off"

    def _update_velocity_label(self, hand: str, velocity: int) -> None:
        label = self.left_velocity if hand == "left" else self.right_velocity
        label.setText(f"{hand.title()} velocity: {velocity}")

    def _append_event(self, event: dict) -> None:
        if not self.show_log.isChecked():
            return
        self._append_log(
            f"[{event['hand'].title()} Hand] Instrument: {event['instrument']}, "
            f"Engine: {event['engine']}, Note: {event['note']}, "
            f"Velocity: {event['velocity']}, "
            f"Duration: {event['duration']:.2f}"
        )

    def _play_event(self, event: dict) -> None:
        if event["engine"] == "soundfont":
            self.synth.stop_live(event["hand"])
            ok = self.soundfont.play_live(
                key=event["hand"],
                midi_note=event["midi_note"],
                velocity=event["velocity"],
                program=event["program"],
            )
            if not ok:
                self._append_log(f"SoundFont unavailable: {self.soundfont.error}")
            return
        self.soundfont.stop_live(event["hand"])
        self.synth.play_live(
            event["hand"],
            event["instrument"],
            event["frequency"],
            event["volume"],
        )

    def _stop_hand(self, hand: str) -> None:
        self.synth.stop_live(hand)
        self.soundfont.stop_live(hand)
        self.mapper.reset_hand(hand)

    def _append_log(self, text: str) -> None:
        self.log.append(text)

    def delete_last(self) -> None:
        removed = self.recorder.delete_last()
        self._append_log(f"Deleted: {removed['note']}" if removed else "No note events to delete.")

    def clear_all(self) -> None:
        if not self.recorder.events:
            return
        answer = QMessageBox.question(self, "Clear sequence", "Clear all recorded note events?")
        if answer == QMessageBox.Yes:
            self.recorder.clear()
            self.log.clear()

    def save_sequence(self) -> None:
        path = self.recorder.save()
        self._append_log(f"Saved sequence: {path}")

    def load_and_replay(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Load sequence", "sequences", "JSON (*.json)")
        if not path:
            return
        self.recorder.load(path)
        try:
            self.synth.start()
        except Exception as exc:
            self._append_log(f"Synth audio unavailable during replay: {exc}")
        Thread(target=self.recorder.replay, args=(self.synth, self.soundfont), daemon=True).start()
        self._append_log(f"Loaded and replayed {len(self.recorder.events)} events.")

    def closeEvent(self, event) -> None:
        self.pause()
        self.soundfont.stop()
        self.tracker.close()
        self.cap.release()
        super().closeEvent(event)
