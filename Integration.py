import os
import sys
import time
import json
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
from cams.hud import render_student_overlay, render_top_bar, print_ansi_status

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_DIR = os.path.join(SCRIPT_DIR, 'Page')
DATA_FILE_PATH = os.path.join(PAGE_DIR, 'data.json')
DATA_TMP_PATH = os.path.join(PAGE_DIR, 'data.json.tmp')
CONFIG_PATH = os.path.join(PAGE_DIR, 'config.json')
FRAME_FEED_PATH = os.path.join(PAGE_DIR, 'camera_feed.jpg')
FRAME_FEED_TMP = os.path.join(PAGE_DIR, 'camera_feed.jpg.tmp')
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, 'camera_check.jpg')

def backends_for(source):
    if sys.platform == 'win32' and isinstance(source, int):
        return [(cv.CAP_DSHOW, 'DirectShow'), (cv.CAP_MSMF, 'MSMF')]
    return [(cv.CAP_ANY, 'default')]

def probe_camera(source, backend):
    cap = cv.VideoCapture(source, backend)
    if not cap.isOpened():
        cap.release()
        return None, False
    got_frame = False
    for _ in range(30):
        ok, frame = cap.read()
        if ok:
            got_frame = True
            if not isinstance(source, int) or frame.mean() > 8:
                return cap, True
        time.sleep(0.08)
    if got_frame:
        return cap, False
    cap.release()
    return None, False

def open_capture(sources):
    dark = None
    for source in sources:
        for backend, name in backends_for(source):
            cap, bright = probe_camera(source, backend)
            if cap is None:
                continue
            if bright:
                print(f"[CAMS] Using video source '{source}' ({name}).")
                return cap
            cap.release()
            if dark is None:
                dark = (source, backend, name)
    if dark is not None:
        source, backend, name = dark
        print(f"[CAMS] Fallback to video source '{source}' ({name}).")
        return cv.VideoCapture(source, backend)
    return None

def write_atomic_json(summary_data):
    """Writes telemetry once per second using an atomic rename."""
    current_time = time.localtime()
    timestamp = time.strftime("%H:%M:%S", current_time)

    payload = {
        "chart": {
            "timestamp": timestamp,
            "overall_score": summary_data["overall_score"],
            "count": summary_data["count"],
            "attention_count": summary_data["attention_count"],
            "sleep_detected": summary_data["sleep_detected"],
            "yawn_detected": summary_data["yawn_detected"],
            "facing_classroom": summary_data["facing_classroom"],
            "attention_scores": [s["score"] for s in summary_data["students"]] or [0.0],
            "students": summary_data["students"]
        }
    }

    try:
        os.makedirs(PAGE_DIR, exist_ok=True)
        with open(DATA_TMP_PATH, 'w') as f:
            json.dump(payload, f)
        os.replace(DATA_TMP_PATH, DATA_FILE_PATH)
    except Exception as e:
        print(f"\n[CAMS] Error writing telemetry JSON: {e}")

def write_atomic_frame(image):
    """Writes annotated frame for MJPEG streaming."""
    try:
        feed_img = cv.resize(image, (640, 360)) if (image.shape[1] > 640) else image
        cv.imwrite(FRAME_FEED_TMP, feed_img, [cv.IMWRITE_JPEG_QUALITY, 75])
        os.replace(FRAME_FEED_TMP, FRAME_FEED_PATH)
    except Exception:
        pass


def main():
    video_source = None
    display_window = True
    max_students = 16  # Adaptive default headroom

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

    candidate_sources = [0, 1, 2, 3] if video_source is None else [video_source]
    capture = open_capture(candidate_sources)

    if capture is None:
        print(f"[CAMS] Error: Unable to open video source '{video_source or 'camera'}'.")
        sys.exit(1)

    mp_face_mesh = mp.solutions.face_mesh
    face_model = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=max_students,
        refine_landmarks=False,
        min_detection_confidence=0.55,
        min_tracking_confidence=0.55
    )

    tracker = MultiStudentTracker(max_faces=max_students, max_jump_radius=0.18)

    window_name = "CAMS Live Monitor"
    if display_window:
        cv.namedWindow(window_name, cv.WINDOW_NORMAL | cv.WINDOW_KEEPRATIO)

    last_json_time = 0.0
    last_frame_feed_time = 0.0
    last_config_check = 0.0
    frame_count = 0
    t_start = time.time()
    fps = 30.0

    print(f"[CAMS] Tracking pipeline active (Adaptive Capacity: {max_students}). Press 'Esc' to exit.")

    while True:
        success, image = capture.read()
        if not success:
            print("\n[CAMS] Video stream ended or frame fetch failed.")
            break

        frame_count += 1
        now = time.time()
        if frame_count % 15 == 0:
            elapsed = now - t_start
            if elapsed > 0:
                fps = 15.0 / elapsed
            t_start = now

        # Periodic check for dynamic dashboard capacity changes
        if now - last_config_check >= 2.0:
            last_config_check = now
            if os.path.exists(CONFIG_PATH):
                try:
                    with open(CONFIG_PATH, 'r') as f:
                        cfg = json.load(f)
                    new_cap = int(cfg.get("max_faces", max_students))
                    if new_cap != tracker.max_faces:
                        tracker.set_max_capacity(new_cap)
                        print(f"\n[CAMS] Dynamically adjusted capacity to: {new_cap} students")
                except Exception:
                    pass

        if frame_count == 1:
            cv.imwrite(SNAPSHOT_PATH, image)

        img_h, img_w = image.shape[:2]
        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        results = face_model.process(image_rgb)

        detected_faces = []

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                nose_lm = face_landmarks.landmark[1]
                centroid = (nose_lm.x, nose_lm.y)

                ear_left = compute_ear(face_landmarks, img_w, img_h, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)
                ear_right = compute_ear(face_landmarks, img_w, img_h, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)
                ear_avg = (ear_left + ear_right) / 2.0

                mar, _, _ = compute_mar(face_landmarks, img_w, img_h, UPPER_LOWER_LIPS, LEFT_RIGHT_LIPS)

                pitch, yaw, roll, direction, rot_vec, trans_vec, cam_matrix, dist_matrix = estimate_head_pose(
                    face_landmarks, img_w, img_h
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

        # Render HUD annotations on video image
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
        print_ansi_status(fps, summary["count"], summary)

        if now - last_json_time >= 1.0:
            write_atomic_json(summary)
            last_json_time = now

        if now - last_frame_feed_time >= 0.08:
            write_atomic_frame(image)
            last_frame_feed_time = now

        if display_window:
            cv.imshow(window_name, image)
            if cv.waitKey(1) & 0xFF == 27:
                break
        else:
            time.sleep(0.005)

    capture.release()
    if display_window:
        cv.destroyAllWindows()
    print("\n[CAMS] Tracking terminated cleanly.")


if __name__ == '__main__':
    main()
