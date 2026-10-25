# CAMS Setup & Reproduction Guide

This guide describes how to run and verify the **Classroom Attention Monitoring System (CAMS)** on macOS, Linux, and Windows.

---

## 1. System Requirements

- **Operating System:** macOS (Apple Silicon / Intel), Windows 10/11, or Linux (Ubuntu 20.04+)
- **Python Version:** **Python 3.10, 3.11, or 3.12** *(Required by MediaPipe 0.10.x and NumPy < 2)*
- **Webcam or Video File:** Built-in webcam, external USB camera, or an MP4 video file.
- **Node.js:** Optional (Zero Node.js dependency; Python `server.py` handles HTTP, WebSocket, and video streaming natively).

---

## 2. One-Click Launch

### On macOS / Linux:
```bash
./start.sh
```
*Options:*
- Run with another camera: `./start.sh 1`
- Run with a prerecorded video: `./start.sh sample_lecture.mp4`
- Run headless (no desktop OpenCV popup): `./start.sh --no-display`

### On Windows:
Double-click `start.bat` or run in Command Prompt:
```cmd
start.bat
```

---

## 3. Manual Step-by-Step Launch

### 1. Create Virtual Environment
```bash
# macOS / Linux (using Python 3.11 or 3.12)
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start the Telemetry & Web Server
```bash
python server.py
```
This runs:
- Web Dashboard at `http://localhost:3000`
- Telemetry WebSocket on `ws://localhost:3000`
- Live MJPEG video stream at `http://localhost:3000/video_feed`

### 3. Start Computer Vision Tracking
In a second terminal window:
```bash
source .venv/bin/activate
python Integration.py
```

---

## 4. Architecture & Key Endpoints

- **Web Dashboard:** `http://localhost:3000`
- **Live Stream Endpoint:** `http://localhost:3000/video_feed`
- **REST Telemetry Data:** `http://localhost:3000/api/data`
- **WebSocket:** `ws://localhost:3000`
- **Telemetry Payload:** Atomic file writes to `Page/data.json` throttled to 1 Hz with zero-race conditions.
