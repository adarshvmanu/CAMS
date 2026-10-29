"""
CAMS Desktop / Standalone CLI Runner
Uses the unified CAMSPipeline to run attention monitoring with an OpenCV desktop window.
"""
import os
import sys
import time
import json
import cv2 as cv

from cams.pipeline import CAMSPipeline
from cams.hud import print_ansi_status

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_DIR = os.path.join(SCRIPT_DIR, 'Page')
DATA_FILE_PATH = os.path.join(PAGE_DIR, 'data.json')
DATA_TMP_PATH = os.path.join(PAGE_DIR, 'data.json.tmp')
FRAME_FEED_PATH = os.path.join(PAGE_DIR, 'camera_feed.jpg')
FRAME_FEED_TMP = os.path.join(PAGE_DIR, 'camera_feed.jpg.tmp')


def probe_camera(source):
    cap = cv.VideoCapture(source)
    if not cap.isOpened():
        cap.release()
        return None
    return cap


def main():
    video_source = 0
    display_window = True
    max_students = 16

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '--no-display':
            display_window = False
        elif arg == '--max-students' and i + 1 < len(args):
            max_students = int(args[i + 1])
            i += 1
        elif arg.isdigit():
            video_source = int(arg)
        elif not arg.startswith('--'):
            video_source = arg
        i += 1

    capture = probe_camera(video_source)
    if capture is None:
        print(f"[CAMS] Error: Unable to open video source '{video_source}'.")
        sys.exit(1)

    pipeline = CAMSPipeline(max_faces=max_students, pitch_offset=0.0, yaw_offset=0.0)

    window_name = "CAMS Live Monitor"
    if display_window:
        cv.namedWindow(window_name, cv.WINDOW_NORMAL | cv.WINDOW_KEEPRATIO)

    last_json_time = 0.0
    print("[CAMS] Tracking pipeline active. Press 'Esc' to exit.")

    while True:
        success, image = capture.read()
        if not success:
            print("\n[CAMS] Stream ended or frame fetch failed.")
            break

        image, summary, fps = pipeline.process_frame(image, draw_hud=True)
        print_ansi_status(fps, summary["count"], summary)

        # Telemetry write throttled to 1 Hz
        now = time.time()
        if now - last_json_time >= 1.0:
            payload = {
                "chart": {
                    "timestamp": time.strftime("%H:%M:%S"),
                    "overall_score": summary["overall_score"],
                    "count": summary["count"],
                    "attention_count": summary["attention_count"],
                    "sleep_detected": summary["sleep_detected"],
                    "yawn_detected": summary["yawn_detected"],
                    "facing_classroom": summary["facing_classroom"],
                    "attention_scores": [s["score"] for s in summary["students"]] or [0.0],
                    "students": summary["students"]
                }
            }
            try:
                os.makedirs(PAGE_DIR, exist_ok=True)
                with open(DATA_TMP_PATH, 'w') as f:
                    json.dump(payload, f)
                os.replace(DATA_TMP_PATH, DATA_FILE_PATH)
            except Exception:
                pass
            last_json_time = now

        if display_window:
            cv.imshow(window_name, image)
            if cv.waitKey(1) & 0xFF == 27:
                break
        else:
            time.sleep(0.005)

    capture.release()
    if display_window:
        cv.destroyAllWindows()
    print("\n[CAMS] Finished cleanly.")


if __name__ == '__main__':
    main()
