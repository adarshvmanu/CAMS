# Classroom Attention Monitoring System (CAMS)

CAMS is a multi-modal computer vision and real-time telemetry studio designed to track classroom student attentiveness using non-invasive facial landmark analysis.

---

## 1. Core Modules & Engineering Architecture

The system extracts 468 facial landmarks via Google MediaPipe FaceMesh (CPU-optimized) and computes composite engagement metrics:

1. **Eye Aspect Ratio (EAR) & Drowsiness Hysteresis:**
   - Tracks eyelid distances using canonical landmarks `[386, 374, 385, 380]` and `[160, 144, 158, 153]`.
   - Threshold: `EAR < 0.22` sustained for `> 22 frames` triggers prolonged drowsiness alerts.
2. **Mouth Aspect Ratio (MAR) & Yawn Detection:**
   - Computes lip aspect ratio with zero-division protection: `ratio_lips = lip_width / max(lip_height, 1e-5)`.
   - Yawn detection hysteresis requires `MIN_YAWN_FRAMES = 15` (~0.5s) to eliminate false triggers from speaking vowels.
3. **Canonical 3D Head Pose Estimation:**
   - Pinhole camera intrinsic matrix calibrated with optical center: `cx = img_w / 2`, `cy = img_h / 2`.
   - Solves Perspective-n-Point (`solvePnP`) using a rigid 6-point anthropometric 3D face model `[1, 199, 33, 263, 61, 291]`.
   - Determines pitch, yaw, roll, and orientation (`Forward`, `Looking Left`, `Looking Right`, `Looking Up`, `Looking Down`).
4. **Multi-Student Centroid Tracker (`cams/tracker.py`):**
   - Tracks up to 4 concurrent students using minimum Euclidean centroid distance matching (maximum jump radius 0.18).
   - Rebalanced attention weights: `w_sleep = 0.45`, `w_facing = 0.35`, `w_yawn = 0.20` (looking away immediately drops instant score to 65%).
   - Smoothed per-student Exponential Moving Average (`EMA, α = 0.15`).
   - Strict Attentive Gate: student is marked attentive only when `EMA >= 80%`, `facing == True`, and `sleep == False`.
5. **IPC & Web Studio Streaming (`server.py`):**
   - Zero Node.js dependency: Python native HTTP, RFC 6455 WebSocket, and MJPEG `/video_feed` server.
   - Throttled atomic telemetry writes to `Page/data.json` at 1 Hz using `os.replace`.
   - Dark-slate single-screen Command Center with live camera stream, 4-seat student roster matrix, 100-point sliding window timeline, and CSV export.

---

## 2. Quick Start

### Prerequisites
- Python 3.10, 3.11, or 3.12
- macOS, Linux, or Windows

### macOS / Linux:
```bash
./start.sh
```

### Windows:
Double-click `start.bat` or run:
```cmd
start.bat
```

### Custom Run Arguments:
- Run with a specific camera index: `./start.sh 1`
- Run with a prerecorded video file: `./start.sh classroom_video.mp4`
- Run headless (no desktop window popup): `./start.sh --no-display`

---

## 3. Package Structure

```
CAMS/
├── cams/
│   ├── __init__.py
│   ├── landmarks.py      # Canonical landmark indices & 3D face model
│   ├── detectors.py      # Pure functions: compute_ear, compute_mar, estimate_head_pose
│   ├── tracker.py        # MultiStudentTracker with centroid matching & EMA scoring
│   └── hud.py            # Corner-bracket bounding boxes, badges & ANSI telemetry
├── Page/
│   ├── Index.html        # Unified Dark-Slate CAMS Studio Dashboard
│   ├── css/style.css     # Design tokens & 12-col responsive grid
│   ├── js/script.js      # Plotly multi-trace timeline (100-pt window) & WebSocket client
│   └── server/server.js  # Alternative Node.js WebSocket & static server
├── Integration.py        # Main computer vision pipeline & telemetry publisher
├── server.py             # Zero-dependency Python HTTP + WebSocket + MJPEG server
├── start.sh              # POSIX launcher script
├── start.bat             # Windows launcher script
├── requirements.txt      # Pinned dependency specifications
├── Test.py               # Automated unit tests
└── REPRODUCE.md          # Step-by-step reproduction guide
```

---

## 4. Future Scope & V2.0 Research Roadmap

- **True Eye-in-Head Iris Gaze Tracking:** Enable `refine_landmarks=True` (landmarks 468–477) to detect downcast glances at phones/laptops when head is facing forward.
- **Per-Seat Angle Auto-Calibration:** 10-second start-of-class baseline vector to eliminate looking-away penalties for side-row seats.
- **Posture & Hand-Raise Recognition:** MediaPipe Pose / YOLOv8n-Pose keypoint tracking.
- **Temporal Deep Learning Engagement Classifier:** 1D-TCN / BiLSTM engagement classifier trained on DAiSEE / EngageNet.
- **Wide-Room Multi-Face Scaling (30+ Students):** Two-stage detect-then-crop pipeline with ByteTrack.
- **Edge Privacy Mode:** Volatile RAM processing with zero persistent video recording.
