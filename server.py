import os
import sys
import time
import json
import base64
import hashlib
import struct
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver
import cv2 as cv
import mediapipe as mp
import numpy as np

from cams.landmarks import (
    LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT,
    RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT,
    UPPER_LOWER_LIPS, LEFT_RIGHT_LIPS
)
from cams.detectors import compute_ear, compute_mar, estimate_head_pose
from cams.tracker import MultiStudentTracker
from cams.hud import render_student_overlay, render_top_bar

PORT = int(os.environ.get("PORT", 3000))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_DIR = os.path.join(SCRIPT_DIR, "Page")
DATA_FILE_PATH = os.path.join(PAGE_DIR, "data.json")

# In-memory real-time pipeline state (Zero disk latency)
pipeline_lock = threading.Lock()
frame_condition = threading.Condition()
latest_jpeg = None
latest_telemetry = {
    "chart": {
        "timestamp": "--:--:--",
        "overall_score": 0.0,
        "count": 0,
        "attention_count": 0,
        "sleep_detected": 0.0,
        "yawn_detected": 0.0,
        "facing_classroom": 0.0,
        "attention_scores": [0.0],
        "students": []
    }
}

# Calibration & Capacity settings
calibration_settings = {
    "pitch_offset": -16.0,  # Default offset for MacBook screen tilt
    "yaw_offset": 0.0,
    "max_faces": 16,
    "auto_scale": True
}

ws_clients = set()
ws_lock = threading.Lock()


def encode_ws_frame(message):
    data = message.encode("utf-8")
    length = len(data)
    frame = bytearray()
    frame.append(0x81)  # FIN + Text

    if length <= 125:
        frame.append(length)
    elif length <= 65535:
        frame.append(126)
        frame.extend(struct.pack("!H", length))
    else:
        frame.append(127)
        frame.extend(struct.pack("!Q", length))

    frame.extend(data)
    return bytes(frame)


def broadcast_telemetry(payload_json_str):
    frame_bytes = encode_ws_frame(payload_json_str)
    with ws_lock:
        dead_clients = set()
        for client in ws_clients:
            try:
                client.sendall(frame_bytes)
            except Exception:
                dead_clients.add(client)
        ws_clients.difference_update(dead_clients)


# ============================================================================
# Integrated In-Memory Computer Vision Pipeline (Real-Time 30 FPS)
# ============================================================================
def vision_pipeline_thread(video_source=0):
    global latest_jpeg, latest_telemetry

    print(f"[CAMS Vision Engine] Starting in-memory capture on source: {video_source}")
    cap = cv.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[CAMS Vision Engine] Fallback to default camera index 0")
        cap = cv.VideoCapture(0)

    if not cap.isOpened():
        print("[CAMS Vision Engine] Warning: Unable to open webcam.")
        return

    mp_face_mesh = mp.solutions.face_mesh
    face_model = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=16,
        refine_landmarks=False,
        min_detection_confidence=0.55,
        min_tracking_confidence=0.55
    )

    tracker = MultiStudentTracker(max_faces=16, max_jump_radius=0.25)
    t_start = time.time()
    frame_count = 0
    fps = 30.0
    last_telemetry_broadcast = 0.0

    while True:
        success, image = cap.read()
        if not success:
            time.sleep(0.03)
            continue

        frame_count += 1
        now = time.time()
        if frame_count % 15 == 0:
            elapsed = now - t_start
            if elapsed > 0:
                fps = 15.0 / elapsed
            t_start = now

        # Update tracker calibration offsets
        tracker.set_calibration(
            calibration_settings["pitch_offset"],
            calibration_settings["yaw_offset"]
        )
        tracker.set_max_capacity(calibration_settings["max_faces"])

        img_h, img_w = image.shape[:2]
        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        results = face_model.process(image_rgb)

        detected_faces = []

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                nose_lm = face_landmarks.landmark[1]
                centroid = (nose_lm.x, nose_lm.y)

                # EAR
                ear_left = compute_ear(face_landmarks, img_w, img_h, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)
                ear_right = compute_ear(face_landmarks, img_w, img_h, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)
                ear_avg = (ear_left + ear_right) / 2.0

                # Standard MAR (height / width)
                mar, _, _ = compute_mar(face_landmarks, img_w, img_h, UPPER_LOWER_LIPS, LEFT_RIGHT_LIPS)

                # Calibrated Head Pose
                pitch, yaw, roll, direction, rot_vec, trans_vec, cam_matrix, dist_matrix = estimate_head_pose(
                    face_landmarks, img_w, img_h,
                    pitch_offset=calibration_settings["pitch_offset"],
                    yaw_offset=calibration_settings["yaw_offset"]
                )

                detected_faces.append({
                    "centroid": centroid,
                    "ear": ear_avg,
                    "mar": mar,
                    "pitch": pitch,
                    "yaw": yaw,
                    "roll": roll,
                    "direction": direction,
                    "rot_vec": rot_vec,
                    "trans_vec": trans_vec,
                    "cam_matrix": cam_matrix,
                    "dist_matrix": dist_matrix,
                    "face_landmarks": face_landmarks
                })

        summary = tracker.update(detected_faces)

        # Draw HUD overlay directly onto stream frame
        for track in tracker.tracks.values():
            if not track.is_active:
                continue
            matched_det = None
            if track.centroid is not None:
                for det in detected_faces:
                    if det["centroid"] == track.centroid:
                        matched_det = det
                        break
            if matched_det:
                render_student_overlay(
                    image, track, matched_det["face_landmarks"],
                    matched_det["rot_vec"], matched_det["trans_vec"],
                    matched_det["cam_matrix"], matched_det["dist_matrix"]
                )

        render_top_bar(image, fps, summary["count"], summary["overall_score"])

        # Encode frame to JPEG directly in RAM (Zero Disk I/O!)
        feed_img = cv.resize(image, (640, 360)) if (image.shape[1] > 640) else image
        ret, buf = cv.imencode('.jpg', feed_img, [cv.IMWRITE_JPEG_QUALITY, 80])
        if ret:
            with frame_condition:
                latest_jpeg = buf.tobytes()
                frame_condition.notify_all()

        # Update telemetry & broadcast once per second
        if now - last_telemetry_broadcast >= 1.0:
            timestamp = time.strftime("%H:%M:%S", time.localtime(now))
            payload = {
                "chart": {
                    "timestamp": timestamp,
                    "overall_score": summary["overall_score"],
                    "count": summary["count"],
                    "attention_count": summary["attention_count"],
                    "sleep_detected": summary["sleep_detected"],
                    "yawn_detected": summary["yawn_detected"],
                    "facing_classroom": summary["facing_classroom"],
                    "attention_scores": [s["score"] for s in summary["students"]] or [0.0],
                    "students": summary["students"],
                    "calibration": calibration_settings
                }
            }
            json_str = json.dumps(payload)
            with pipeline_lock:
                latest_telemetry = payload

            # Update file atomically for REST fallback
            try:
                os.makedirs(PAGE_DIR, exist_ok=True)
                tmp_file = DATA_FILE_PATH + ".tmp"
                with open(tmp_file, "w") as f:
                    f.write(json_str)
                os.replace(tmp_file, DATA_FILE_PATH)
            except Exception:
                pass

            broadcast_telemetry(json_str)
            last_telemetry_broadcast = now


# ============================================================================
# HTTP & WebSocket Request Handler
# ============================================================================
class CAMSUnifiedHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PAGE_DIR, **kwargs)

    def do_HEAD(self):
        if self.path in ("/video_feed", "/api/data", "/api/config"):
            self.send_response(200)
            self.end_headers()
            return
        return super().do_HEAD()

    def do_POST(self):
        # 1. Zero-Calibrate Head Pose Endpoint
        if self.path == "/api/calibrate":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                data = json.loads(body) if body else {}
                # If specific offsets sent, use them; otherwise auto-calibrate to current face pitch/yaw
                with pipeline_lock:
                    students = latest_telemetry.get("chart", {}).get("students", [])
                    if students and len(students) > 0:
                        s1 = students[0]
                        # Current relative pitch is raw_pitch - old_offset -> raw_pitch = cal_pitch + old_offset
                        raw_p = s1["pitch"] + calibration_settings["pitch_offset"]
                        raw_y = s1["yaw"] + calibration_settings["yaw_offset"]
                        calibration_settings["pitch_offset"] = raw_p
                        calibration_settings["yaw_offset"] = raw_y
                    elif "pitch_offset" in data:
                        calibration_settings["pitch_offset"] = float(data["pitch_offset"])
                        calibration_settings["yaw_offset"] = float(data.get("yaw_offset", 0.0))

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "calibration": calibration_settings}).encode("utf-8"))
                return
            except Exception as e:
                self.send_error(400, str(e))
                return

        # 2. Capacity Setting Endpoint
        if self.path == "/api/config":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                cfg = json.loads(body)
                if "max_faces" in cfg:
                    calibration_settings["max_faces"] = int(cfg["max_faces"])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
                return
            except Exception as e:
                self.send_error(400, str(e))
                return

        return super().do_POST()

    def do_GET(self):
        # 1. WebSocket Upgrade
        if self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_websocket_handshake()
            return

        # 2. REST API /api/data
        if self.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with pipeline_lock:
                self.wfile.write(json.dumps(latest_telemetry).encode("utf-8"))
            return

        # 3. Real-Time 30 FPS In-Memory MJPEG Video Feed
        if self.path == "/video_feed":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.end_headers()

            while True:
                with frame_condition:
                    # Wait for next fresh frame from OpenCV thread (up to 40ms)
                    frame_condition.wait(timeout=0.05)
                    jpeg_bytes = latest_jpeg

                if jpeg_bytes:
                    try:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                        self.wfile.write(jpeg_bytes)
                        self.wfile.write(b"\r\n")
                    except (BrokenPipeError, ConnectionResetError):
                        break
                    except Exception:
                        break
            return

        # 4. Route root to Index.html
        if self.path in ("/", "/index", "/index.html"):
            self.path = "/Index.html"

        return super().do_GET()

    def handle_websocket_handshake(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        if not key:
            self.send_error(400, "Missing Sec-WebSocket-Key")
            return

        guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        accept_raw = hashlib.sha1((key + guid).encode("utf-8")).digest()
        accept_token = base64.b64encode(accept_raw).decode("utf-8")

        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_token}\r\n\r\n"
        )
        self.wfile.write(response.encode("utf-8"))

        raw_sock = self.request
        with ws_lock:
            ws_clients.add(raw_sock)

        # Send latest state immediately
        with pipeline_lock:
            init_json = json.dumps(latest_telemetry)
        raw_sock.sendall(encode_ws_frame(init_json))

        try:
            while True:
                head = raw_sock.recv(2)
                if not head or len(head) < 2:
                    break
                opcode = head[0] & 0x0F
                if opcode == 0x8:
                    break
                payload_len = head[1] & 0x7F
                if payload_len == 126:
                    raw_sock.recv(2)
                elif payload_len == 127:
                    raw_sock.recv(8)
                mask = head[1] & 0x80
                if mask:
                    raw_sock.recv(4)
                to_read = payload_len
                while to_read > 0:
                    chunk = raw_sock.recv(min(to_read, 4096))
                    if not chunk:
                        break
                    to_read -= len(chunk)
        except Exception:
            pass
        finally:
            with ws_lock:
                ws_clients.discard(raw_sock)


class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    video_source = 0
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        video_source = int(sys.argv[1])
    elif len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        video_source = sys.argv[1]

    # Start in-memory real-time CV pipeline thread
    t = threading.Thread(target=vision_pipeline_thread, args=(video_source,), daemon=True)
    t.start()

    server = ThreadedHTTPServer(("0.0.0.0", PORT), CAMSUnifiedHandler)
    print(f"\n=======================================================")
    print(f"  CAMS Studio Live Engine Active")
    print(f"  Web Dashboard:   http://localhost:{PORT}")
    print(f"  Live Video Feed: http://localhost:{PORT}/video_feed")
    print(f"  Telemetry WS:    ws://localhost:{PORT}")
    print(f"=======================================================\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[CAMS Studio] Stopped.")


if __name__ == "__main__":
    main()
