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

from cams.pipeline import CAMSPipeline

PORT = int(os.environ.get("PORT", 3000))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_DIR = os.path.join(SCRIPT_DIR, "Page")
DATA_FILE_PATH = os.path.join(PAGE_DIR, "data.json")

# In-memory pipeline state
pipeline_lock = threading.Lock()
frame_condition = threading.Condition()
latest_jpeg = None
active_video_clients = 0
clients_lock = threading.Lock()

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

calibration_settings = {
    "pitch_offset": -16.0,  # Default offset for MacBook screen tilt
    "yaw_offset": 0.0,
    "max_faces": 16,
    "auto_scale": True
}

ws_clients = set()
ws_lock = threading.Lock()
pipeline = CAMSPipeline(max_faces=16, pitch_offset=-16.0, yaw_offset=0.0)


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


# Vision pipeline background worker
def vision_pipeline_thread(video_source=0):
    global latest_jpeg, latest_telemetry

    print(f"[CAMS Vision Engine] Starting in-memory capture on source: {video_source}")
    cap = cv.VideoCapture(video_source)
    if not cap.isOpened() and isinstance(video_source, int):
        cap = cv.VideoCapture(0)

    if not cap.isOpened():
        print("[CAMS Vision Engine] Warning: Unable to open webcam.")
        return

    last_broadcast_time = 0.0

    while True:
        success, image = cap.read()
        if not success:
            time.sleep(0.03)
            continue

        # Sync calibration & capacity
        pipeline.set_calibration(
            calibration_settings["pitch_offset"],
            calibration_settings["yaw_offset"]
        )
        pipeline.set_max_capacity(calibration_settings["max_faces"])

        # Process frame through unified pipeline
        image, summary, fps = pipeline.process_frame(image, draw_hud=True)
        now = time.time()

        # Client-aware JPEG compression (encodes only if a browser is actively watching)
        with clients_lock:
            need_stream = (active_video_clients > 0)

        if need_stream or latest_jpeg is None:
            feed_img = cv.resize(image, (640, 360)) if (image.shape[1] > 640) else image
            ret, buf = cv.imencode('.jpg', feed_img, [cv.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                with frame_condition:
                    latest_jpeg = buf.tobytes()
                    frame_condition.notify_all()

        # Telemetry broadcast throttled to 1 Hz
        if now - last_broadcast_time >= 1.0:
            timestamp = time.strftime("%H:%M:%S")
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

            # Atomic disk save for REST polling fallback
            try:
                os.makedirs(PAGE_DIR, exist_ok=True)
                tmp_file = DATA_FILE_PATH + ".tmp"
                with open(tmp_file, "w") as f:
                    f.write(json_str)
                os.replace(tmp_file, DATA_FILE_PATH)
            except Exception:
                pass

            broadcast_telemetry(json_str)
            last_broadcast_time = now


# HTTP Server & WebSocket Request Handler
class CAMSUnifiedHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PAGE_DIR, **kwargs)

    def do_HEAD(self):
        if self.path in ("/video_feed", "/api/data", "/api/config", "/api/calibrate"):
            self.send_response(200)
            self.end_headers()
            return
        return super().do_HEAD()

    def do_POST(self):
        if self.path == "/api/calibrate":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                with pipeline_lock:
                    students = latest_telemetry.get("chart", {}).get("students", [])
                    if students and len(students) > 0:
                        s1 = students[0]
                        raw_p = s1["pitch"] + calibration_settings["pitch_offset"]
                        raw_y = s1["yaw"] + calibration_settings["yaw_offset"]
                        calibration_settings["pitch_offset"] = raw_p
                        calibration_settings["yaw_offset"] = raw_y

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "calibration": calibration_settings}).encode("utf-8"))
                return
            except Exception as e:
                self.send_error(400, str(e))
                return

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
        # WebSocket Upgrade
        if self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_websocket_handshake()
            return

        # REST API /api/data
        if self.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with pipeline_lock:
                self.wfile.write(json.dumps(latest_telemetry).encode("utf-8"))
            return

        # Real-Time 30 FPS In-Memory MJPEG Stream
        if self.path == "/video_feed":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.end_headers()

            with clients_lock:
                global active_video_clients
                active_video_clients += 1

            try:
                while True:
                    with frame_condition:
                        frame_condition.wait(timeout=0.04)
                        jpeg_bytes = latest_jpeg

                    if jpeg_bytes:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                        self.wfile.write(jpeg_bytes)
                        self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                with clients_lock:
                    active_video_clients = max(0, active_video_clients - 1)
            return

        # Route root
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

    t = threading.Thread(target=vision_pipeline_thread, args=(video_source,), daemon=True)
    t.start()

    server = ThreadedHTTPServer(("0.0.0.0", PORT), CAMSUnifiedHandler)
    print(f"\n=======================================================")
    print(f"  CAMS Studio Unified Live Engine Active")
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
