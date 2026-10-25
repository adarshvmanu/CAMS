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

PORT = int(os.environ.get("PORT", 3000))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_DIR = os.path.join(SCRIPT_DIR, "Page")
DATA_FILE_PATH = os.path.join(PAGE_DIR, "data.json")
CONFIG_PATH = os.path.join(PAGE_DIR, "config.json")
FRAME_FEED_PATH = os.path.join(PAGE_DIR, "camera_feed.jpg")
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, "camera_check.jpg")

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


def broadcast_telemetry_loop():
    last_content = ""
    while True:
        try:
            if os.path.exists(DATA_FILE_PATH):
                with open(DATA_FILE_PATH, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                if content and content != last_content:
                    last_content = content
                    frame_bytes = encode_ws_frame(content)
                    with ws_lock:
                        dead_clients = set()
                        for client in ws_clients:
                            try:
                                client.sendall(frame_bytes)
                            except Exception:
                                dead_clients.add(client)
                        ws_clients.difference_update(dead_clients)
        except Exception:
            pass
        time.sleep(1.0)


class CAMSUnifiedHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PAGE_DIR, **kwargs)

    def do_POST(self):
        # Configuration endpoint for dashboard capacity adjustment
        if self.path == "/api/config":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                cfg = json.loads(body)
                with open(CONFIG_PATH, "w") as f:
                    json.dump(cfg, f)
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
            if os.path.exists(DATA_FILE_PATH):
                with open(DATA_FILE_PATH, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'{"chart": {"status": "waiting", "students": []}}')
            return

        # 3. REST API /api/config
        if self.path == "/api/config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'{"max_faces": 16, "mode": "auto"}')
            return

        # 4. Live MJPEG Video Feed
        if self.path == "/video_feed":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.end_headers()

            while True:
                try:
                    target = FRAME_FEED_PATH if os.path.exists(FRAME_FEED_PATH) else SNAPSHOT_PATH
                    if os.path.exists(target):
                        with open(target, "rb") as f:
                            jpg_bytes = f.read()
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                        self.wfile.write(jpg_bytes)
                        self.wfile.write(b"\r\n")
                    time.sleep(0.08)
                except (BrokenPipeError, ConnectionResetError):
                    break
                except Exception:
                    time.sleep(0.1)
            return

        # 5. Route root to Index.html
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

        if os.path.exists(DATA_FILE_PATH):
            try:
                with open(DATA_FILE_PATH, "r", encoding="utf-8") as f:
                    latest = f.read().strip()
                if latest:
                    raw_sock.sendall(encode_ws_frame(latest))
            except Exception:
                pass

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
    threading.Thread(target=broadcast_telemetry_loop, daemon=True).start()
    server = ThreadedHTTPServer(("0.0.0.0", PORT), CAMSUnifiedHandler)
    print(f"[CAMS Server] Serving at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[CAMS Server] Stopped.")


if __name__ == "__main__":
    main()
