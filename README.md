# Classroom Attention Monitoring System (CAMS)
### *v3.2 Architectural Studio — High-Precision Edge Computer Vision & Classroom Telemetry*

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-FaceMesh%20468%20Landmarks-0071E3)](https://developers.google.com/mediapipe)
[![Stream](https://img.shields.io/badge/Stream-Zero--Copy%20RAM%20MJPEG-10B981)](#2-high-throughput-in-memory-optical-pipeline)
[![Controller](https://img.shields.io/badge/Lifecycle-Unified%20cams.py%20Controller-8B5CF6)](#6-unified-cross-platform-controller-camspy)
[![License](https://img.shields.io/badge/License-Academic%20%2F%20Institutional-64748B)](#8-the-founding-engineering-team)

**CAMS** (Classroom Attention Monitoring System) is an edge-native, real-time computer vision studio engineered for non-invasive educational telemetry. Built for institutional classrooms and university lecture theaters, CAMS continuously evaluates student cognitive alertness, gaze direction, and fatigue vectors using 468 canonical 3D facial landmarks—delivering true **60 FPS** fluid execution on standard consumer laptops and lab workstations without requiring dedicated GPU clusters or cloud infrastructure.

---

## 1. Core Biomechanical & Kinematic Formulations

CAMS replaces primitive heuristic triggers with biologically grounded kinematic models:

```
                                  [ Raw Video Frame ]
                                          │
                        (Proportional 640px Aspect Rescaling)
                                          │
                        [ MediaPipe 468-Landmark FaceMesh ]
                                          │
          ┌───────────────────────────────┼──────────────────────────────┐
          ▼                               ▼                              ▼
 [ Ocular Kinematics ]           [ Oral Kinematics ]            [ 3D Head Pose ]
 • Canonical EAR Metric          • Vertical/Horizontal MAR      • solvePnP Pinhole Model
 • Adaptive Percentile Baseline  • 6-Frame Yawn Hysteresis      • RQDecomp3x3 Euler Angles
 • Synkinesis Sleep Suppressor   • Lip Dilation Gate            • Schmitt Deadband (22°/18°)
          └───────────────────────────────┬──────────────────────────────┘
                                          ▼
                         [ Asymmetric Kinematic Damper ]
                         • Fast-Attack Distraction (α = 0.35)
                         • Calm Baseline Recovery (α = 0.12)
                         • 1st-Order Velocity Derivative
                                          ▼
                         [ Tiered Semantic Classification ]
                         Yawn > Sleep > Head Direction > Focus Tier
```

### I. Eye Aspect Ratio (EAR) & Adaptive Baseline
Alertness is quantified across upper and lower eyelid coordinates:
$$\text{EAR} = \frac{\|\mathbf{p}_{386} - \mathbf{p}_{374}\| + \|\mathbf{p}_{385} - \mathbf{p}_{380}\|}{2 \cdot \|\mathbf{p}_{263} - \mathbf{p}_{362}\|}$$
- **Adaptive Personal Baseline:** Rather than using rigid static cutoffs, CAMS samples a rolling 60-frame history of open-eye states ($\text{EAR} > 0.16$) and derives the individual baseline from the **75th percentile**.
- **Dynamic Alert Threshold:** Calibrated dynamically as $68\%$ of the subject's baseline, strictly bounded within $[0.14, 0.21]$ to prevent false alerts across diverse anthropometric eye shapes.

### II. Biomechanical Synkinesis Isolation (Yawn vs. Sleep)
In human facial motor physiology, involuntary squinting of the *orbicularis oculi* muscle naturally accompanies broad mouth dilation during a yawn. Conventional CV systems misclassify this as microsleep or drowsiness:
- **Kinematic Guard:** When mouth dilation reaches active yawn thresholds ($\text{MAR} \ge 0.38$ or yawn counter $> 0$), drowsiness frame accumulation is **temporarily suppressed**.
- **Yawn Detection:** Evaluated across upper/lower inner lips (`[13, 14]`) and oral commissures (`[78, 308]`):
  $$\text{MAR} = \frac{\|\mathbf{p}_{13} - \mathbf{p}_{14}\|}{\max(\|\mathbf{p}_{78} - \mathbf{p}_{308}\|, 10^{-5})}$$
  A yawn event is confirmed when $\text{MAR} \ge 0.40$ is sustained for $\ge 6$ consecutive frames ($\sim 200\text{ms}$ at 30 FPS).

### III. 3D Head-Pose Estimation & Schmitt-Trigger Deadband
Head orientation is solved in real time using OpenCV's `solvePnP` against canonical anthropometric 3D facial coordinates:
- **Maximal Angular Deviation:** Evaluates dominant orientation via $\max(|\text{Pitch}|, |\text{Yaw}|)$, ensuring downward note-taking angles ($\text{Pitch} > 16^\circ$) are not incorrectly overridden by slight yaw biases.
- **Schmitt-Trigger Deadband:** Prevents boundary flutter between *Forward* and *Averted* states:
  - Transition from *Forward* to *Averted* requires angular deviation $\ge 22.0^\circ$.
  - Return to *Forward* requires deviation to drop strictly below $18.0^\circ$.
  - Eliminates micro-twitch fluttering and guarantees 100% mutual consistency between direction reporting and attention scoring on every frame.

### IV. Asymmetric Kinematic Damper
Instantaneous attention scores are smoothed using an asymmetric kinematic damper:
- **Fast Attack ($\alpha = 0.35$):** Swiftly captures genuine distraction or head-down deflection within $200\text{ms}$.
- **Calm Decay ($\alpha = 0.12$):** Gradually recovers to baseline upon return to the front, eliminating distracting blinks, micro-twitches, and eye-flutter noise.
- **Attention Velocity:** Computes 1st-order temporal derivative ($\Delta\%/\text{frame}$) to flag impending engagement drop-offs before critical divergence occurs.

### V. Strict Semantic Priority Tiering
Every student track evaluates status via strict hierarchical priority:
$$\text{Yawning} \succ \text{Sleeping} \succ \text{Dominant Head Direction} \succ \text{Distracted (<45\%)} \succ \text{Passive (<70\%)} \succ \text{Attentive (\ge 70\%)}$$

---

## 2. High-Throughput In-Memory Optical Pipeline

```
Camera Frame ➔ Aspect Rescale (640px) ➔ MediaPipe FaceMesh ➔ Multi-Student Tracker ➔ RAM JPEG Buffer ➔ Web Browser
```

- **Zero Disk Writes:** Eliminates legacy SSD write wear (`cv2.imwrite("current_frame.jpg")`) and optical streaming lag. Live frames are encoded directly into volatile memory JPEG buffers and distributed via `threading.Condition` across `/video_feed`.
- **Latency & Throughput:** Inference runs in $\sim 8\text{ms} - 12\text{ms}$ per frame on Apple Silicon and modern x86 CPUs, maintaining fluid **50+ FPS** capture and sub-15ms browser delivery.
- **Aspect-Ratio Preserved Width Normalization:** Standardizes arbitrary webcam resolutions (1080p, 720p, 4:3, 16:9) to a maximum width of $640\text{px}$ while preserving native aspect ratios, preventing distorted EAR/MAR measurements.
- **Dynamic Multi-Student Scaling:** Supports **1 to 16+ participants** simultaneously via minimum Euclidean distance centroid matching accelerated with C-level `math.hypot`.

---

## 3. High-Density Swiss Studio Dashboard

The frontend ([`Page/Index.html`](file:///Users/nona/Desktop/adarshs-CAMS/CAMS/Page/Index.html)) adopts a high-contrast, linear Swiss design system built with clean 1px hairline borders and `JetBrains Mono` tabular figures:

1. **Cinematic "Awakening Eye" Bootloader:**
   - Vector SVG eye aperture with cubic-bezier eyelid easing, rotating radar sweep ray, 468-point mesh constellation, and automated progress logging.
2. **Precision Visual Gaze Overlay:**
   - High-DPI corner-bracket bounding boxes dynamically color-coded by cognitive tier (Emerald = Attentive, Amber = Note-Taking / Averted, Rose = Critical Sleep / Yawn).
   - Physically calibrated 3D Gaze Vector Ray projecting from the nose tip along real Euler pitch and yaw angles.
   - 3D Axial Pose Wireframe Gizmo Sphere with continuous roll-angle rotation.
3. **Interactive Temporal Curve & Deep Insight Studio:**
   - **Marquee Crop-Zoom:** Click and drag across the engagement timeline to isolate micro-intervals.
   - **Mini-Timeline Scrubber:** Shift+drag or scrub across historical telemetry slices.
   - **Forensic Deep Insight Modal:** 4-KPI matrix, interval slice waveform, pedagogical anomaly diagnosis, frame-by-frame ledger, CSV slice export, and JSON incident export.
4. **Real-Time Classroom Engagement Digest:**
   - Sub-second AI pulse updating on every 1 Hz telemetry packet, providing synthesized pedagogical insights and classroom state digests.
5. **Participant Biometric Ledger:**
   - Live tabular matrix with 4 Hz throttle, dynamic 5-second per-student sparkline waveforms, and 2.0s SVG ring hysteresis indicators.

---

## 4. Quick Start & Unified Controller (`cams.py`)

CAMS provides a single-file, zero-dependency system manager ([`cams.py`](file:///Users/nona/Desktop/adarshs-CAMS/CAMS/cams.py)) supporting macOS, Windows, and Linux natively.

### CLI Commands

```bash
# Start CAMS in background & open browser dashboard automatically
python cams.py start

# Check live process state, active port, PID, uptime, and health API
python cams.py status

# Cleanly terminate all background workers, release optical sensor, and clear locks
python cams.py stop

# Graceful clean-kill followed by fresh startup
python cams.py restart

# Run in foreground with live terminal output (Ctrl+C to stop)
python cams.py run
```

### OS-Native Launchers
- **macOS / Linux:** `./start.sh` (or `./start.sh stop`, `./start.sh restart`)
- **Windows:** Double-click `start.bat` or execute `start.bat` in Command Prompt.

### Custom Video Inputs
```bash
# Run on secondary USB webcam (device index 1)
python cams.py start 1

# Run on prerecorded classroom lecture video
python cams.py start /path/to/lecture.mp4
```

---

## 5. Endpoints & Telemetry Architecture

When active, CAMS hosts a unified, multi-threaded server on port `3000`:

| Endpoint | Protocol | Description |
| :--- | :--- | :--- |
| `http://localhost:3000` | HTTP | High-Density Swiss Studio Dashboard |
| `http://localhost:3000/video_feed` | MJPEG | Zero-copy volatile RAM video stream |
| `ws://localhost:3000` | WebSocket | High-frequency telemetry broadcast (1 Hz) |
| `http://localhost:3000/api/data` | REST | Snapshot JSON telemetry fallback |
| `http://localhost:3000/api/calibrate` | POST | Dynamic pitch and yaw offset recalibration |
| `http://localhost:3000/api/config` | POST | Dynamic classroom capacity adjustment |

---

## 6. Project Architecture

```
CAMS/
├── cams/
│   ├── __init__.py
│   ├── landmarks.py      # Canonical 3D face model & landmark index definitions
│   ├── detectors.py      # Inlined Euclidean math: compute_ear, compute_mar, estimate_head_pose
│   ├── tracker.py        # MultiStudentTracker with Schmitt deadband & Asymmetric Kinematic Damper
│   ├── pipeline.py       # Zero-copy CAMSPipeline with proportional aspect downsampling
│   └── hud.py            # Physically aligned 3D gaze rays & corner-bracket bounding overlays
├── Page/
│   ├── Index.html        # High-Density Swiss Studio Dashboard & Deep Insight Modal
│   ├── about.html        # System Architecture & Master Transformation Specifications
│   ├── Team.html         # Research & Founding Engineering Team recognition
│   ├── css/style.css     # Clean Apple HIG / Linear design tokens & responsive grid
│   └── js/
│       ├── chart.umd.min.js  # Bundled standalone offline Chart.js engine
│       └── script.js         # Master telemetry coordinator, retina canvases & crop-zoom
├── cams.py               # Unified cross-platform single-file lifecycle controller
├── server.py             # Pure-Python multi-threaded HTTP + WebSocket + MJPEG engine
├── Integration.py        # Standalone desktop CLI runner with native OpenCV window
├── Test.py               # Automated unit test suite (11/11 tests)
├── requirements.txt      # Dependency specification (OpenCV, MediaPipe, NumPy)
├── start.sh              # POSIX launcher script
├── start.bat             # Windows launcher script
└── README.md             # System documentation & technical specification
```

---

## 7. Automated Unit Test Suite

CAMS includes an automated regression test suite in [`Test.py`](file:///Users/nona/Desktop/adarshs-CAMS/CAMS/Test.py) verifying all computer vision formulas and state-machine transitions:

```bash
cd CAMS
.venv/bin/python Test.py
```

```
...........
----------------------------------------------------------------------
Ran 11 tests in 0.005s

OK
```

- `test_canonical_face_model`: Verifies anthropometric 3D model geometry.
- `test_student_track_rebalancing`: Confirms instantaneous re-scoring upon gaze aversion.
- `test_yawn_hysteresis`: Verifies 6-frame oral dilation validation.
- `test_asymmetric_kinematic_damper`: Validates fast attack ($\alpha=0.35$) vs calm decay ($\alpha=0.12$).
- `test_yawn_with_eye_squint_suppresses_false_sleep`: Verifies synkinesis isolation.
- `test_status_tiering_prevents_false_attentive`: Enforces strict attentive gates.
- `test_student_track_dictionary_serialization`: Verifies telemetry schema and bounding boxes.
- `test_dynamic_ear_threshold_bounds`: Enforces $[0.14, 0.21]$ adaptive boundaries.
- `test_multistudent_tracker_slot_reset`: Validates 30-frame grace periods and slot resets.
- `test_direction_schmitt_trigger_hysteresis`: Verifies $22^\circ / 18^\circ$ boundary deadband.
- `test_direction_status_mutual_consistency`: Verifies 100% agreement between direction and status.

---

## 8. The Founding Engineering Team

CAMS was conceptualized and engineered by the foundational computer vision research group:

- **Adarsh Varghese Manu** — *Project Lead & 3D Head-Pose Estimation*  
  Pioneered the Perspective-n-Point (`solvePnP`) architectural integration and Euler decomposition matrix mapping using 3D canonical facial mesh coordinates.
- **Archa Sekhar** — *Computer Vision Engineer & Yawn/Fatigue Kinematics*  
  Researched and implemented the Mouth Aspect Ratio (`MAR`) kinematics, defining oral landmark extraction protocols for real-time fatigue identification.
- **B Anand** — *Computer Vision Engineer & Eye Closure/EAR Kinematics*  
  Engineered the Eye Aspect Ratio (`EAR`) drowsiness formulation, analyzing upper and lower eyelid coordinates to quantify blink duration and microsleep episodes.

---

## 9. Ethics, Privacy & FERPA/GDPR Compliance

- **Zero Persistent Video Storage:** Video frames exist solely in volatile RAM buffers for the duration of inference ($< 15\text{ms}$) and are never written to disk or uploaded to external clouds.
- **On-Device Edge Computing:** All landmark extraction and kinematics execute strictly on the local CPU host.
- **FERPA & Privacy Compliant:** No biometric face-recognition templates, unique identity embeddings, or biometric identity databases are constructed or retained.
