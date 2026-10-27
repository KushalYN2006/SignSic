from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from typing import Iterable

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

from config import HAND_LANDMARKER_MODEL


@dataclass
class TrackedHand:
    label: str
    landmarks: list[tuple[float, float, float]]


class HandTracker:
    """MediaPipe Tasks wrapper that returns normalized 21-point hand landmarks."""

    def __init__(self) -> None:
        model_path = Path(HAND_LANDMARKER_MODEL)
        if not model_path.exists():
            raise FileNotFoundError(
                f"Missing {model_path}. Download the MediaPipe hand landmarker model first."
            )
        options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.7,
            min_tracking_confidence=0.7,
        )
        self._landmarker = vision.HandLandmarker.create_from_options(options)
        self._start_time = monotonic()
        self.connections = [
            (connection.start, connection.end)
            for connection in vision.HandLandmarksConnections.HAND_CONNECTIONS
        ]

    def detect(self, bgr_frame) -> list[TrackedHand]:
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int((monotonic() - self._start_time) * 1000)
        results = self._landmarker.detect_for_video(image, timestamp_ms)
        if not results.hand_landmarks:
            return []

        hands: list[TrackedHand] = []
        handedness = results.handedness or []
        for idx, hand_landmarks in enumerate(results.hand_landmarks):
            label = "unknown"
            if idx < len(handedness):
                label = handedness[idx][0].category_name.lower()
            points = [(lm.x, lm.y, lm.z) for lm in hand_landmarks]
            hands.append(TrackedHand(label=label, landmarks=points))
        return hands

    def close(self) -> None:
        self._landmarker.close()


def normalized_to_pixels(
    landmarks: Iterable[tuple[float, float, float]], width: int, height: int
) -> list[tuple[int, int]]:
    return [(int(x * width), int(y * height)) for x, y, _ in landmarks]
