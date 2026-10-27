APP_QSS = """
QMainWindow, QWidget {
    background: #101317;
    color: #eef3f8;
    font-family: Segoe UI, Arial, sans-serif;
    font-size: 13px;
}
QGroupBox {
    border: 1px solid #2c3440;
    border-radius: 8px;
    margin-top: 16px;
    padding: 14px 12px 12px;
    background: #171c22;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    padding: 0 4px;
    color: #91d6ff;
    font-weight: 600;
}
QPushButton {
    background: #25303b;
    border: 1px solid #3a4654;
    border-radius: 6px;
    padding: 8px 12px;
    font-weight: 600;
}
QPushButton:hover {
    background: #31404d;
}
QPushButton#primary {
    background: #1c7c7a;
    border-color: #2aa9a4;
}
QPushButton#danger {
    background: #763139;
    border-color: #a64a55;
}
QTextEdit {
    background: #090b0f;
    border: 1px solid #2c3440;
    border-radius: 8px;
    color: #d8f9ff;
    font-family: Consolas, monospace;
}
QLabel#hint {
    color: #aab6c2;
}
"""
