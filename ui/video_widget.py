from __future__ import annotations

import cv2
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QImage, QPixmap
from PyQt5.QtWidgets import QLabel

from hand_tracker import TrackedHand, normalized_to_pixels


LANDMARK_RADIUS = 4
LANDMARK_COLOR_LEFT = (0, 220, 255)
LANDMARK_COLOR_RIGHT = (255, 220, 0)


class VideoWidget(QLabel):
    def __init__(self) -> None:
        super().__init__()
        self.setMinimumSize(640, 360)
        self.setAlignment(Qt.AlignCenter)
        self.setStyleSheet("background: #05070a; border-radius: 8px;")
        self.setText("Camera paused")

    def show_frame(self, frame, hands: list[TrackedHand], _connections, show_raw: bool) -> None:
        height, width = frame.shape[:2]
        canvas = frame.copy() if show_raw else frame * 0
        for hand in hands:
            pts = normalized_to_pixels(hand.landmarks, width, height)
            color = LANDMARK_COLOR_LEFT if hand.label == "left" else LANDMARK_COLOR_RIGHT
            for x, y in pts:
                cv2.circle(canvas, (x, y), LANDMARK_RADIUS, color, -1, cv2.LINE_AA)
            cv2.putText(
                canvas,
                hand.label.title(),
                pts[0],
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
                cv2.LINE_AA,
            )

        rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        image = QImage(rgb.data, width, height, rgb.strides[0], QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(image).scaled(
            self.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation
        )
        self.setPixmap(pixmap)
