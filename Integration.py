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
FRAME_FEED_PATH = os.path.join(PAGE_DIR, 'camera_feed.jpg')
FRAME_FEED_TMP = os.path.join(PAGE_DIR, 'camera_feed.jpg.tmp')
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, 'camera_check.jpg')

# Camera backend detection & options
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

    # Payload matching Section 4 Fix 4.1 in CAMS Remediation Plan
    payload = {
        "chart": {
            "timestamp": timestamp,
            "overall_score": summary_data["overall_score"],
            "count": summary_data["count"],
            "attention_count": summary_data["attention_count"],
            "sleep_detected": summary_data["sleep_detected"],
            "yawn_detected": summary_data["yawn_detected"],
            "facing_classroom": summary_data["facing_classroom"],
            "attention_scores": [s["score"] for s in summary_data["students"] if s["active"]] or [0.0],
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
        # Resize for optimal stream performance
        feed_img = cv.resize(image, (640, 360)) if (image.shape[1] > 640) else image
        cv.imwrite(FRAME_FEED_TMP, feed_img, [cv.IMWRITE_JPEG_QUALITY, 75])
        os.replace(FRAME_FEED_TMP, FRAME_FEED_PATH)
    except Exception:
        pass


def main():
    video_source = None
    display_window = True

    for arg in sys.argv[1:]:
        if arg == '--no-display':
            display_window = False
        elif arg.isdigit():
            video_source = int(arg)
        elif not arg.startswith('--'):
            video_source = arg

    candidate_sources = [0, 1, 2, 3] if video_source is None else [video_source]
    capture = open_capture(candidate_sources)

    if capture is None:
        print(f"[CAMS] Error: Unable to open video source '{video_source or 'camera'}'.")
        print("Please check camera permissions or run with a video file: python Integration.py video.mp4")
        sys.exit(1)

    # Initialize MediaPipe FaceMesh
    mp_face_mesh = mp.solutions.face_mesh
    face_model = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=4,
        refine_landmarks=False,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6
    )

    tracker = MultiStudentTracker(max_faces=4, max_jump_radius=0.18)

    window_name = "CAMS Live Monitor"
    if display_window:
        cv.namedWindow(window_name, cv.WINDOW_NORMAL | cv.WINDOW_KEEPRATIO)

    last_json_time = 0.0
    last_frame_feed_time = 0.0
    frame_count = 0
    t_start = time.time()
    fps = 30.0

    print("[CAMS] Tracking pipeline active. Press 'Esc' to exit.")

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

        if frame_count == 1:
            cv.imwrite(SNAPSHOT_PATH, image)

        img_h, img_w = image.shape[:2]
        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        results = face_model.process(image_rgb)

        detected_faces = []

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # 1. Centroid (from nose landmark 1)
                nose_lm = face_landmarks.landmark[1]
                centroid = (nose_lm.x, nose_lm.y)

                # 2. EAR (Eye Aspect Ratio)
                ear_left = compute_ear(face_landmarks, img_w, img_h, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)
                ear_right = compute_ear(face_landmarks, img_w, img_h, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)
                ear_avg = (ear_left + ear_right) / 2.0

                # 3. MAR (Mouth Aspect Ratio)
                mar, _, _ = compute_mar(face_landmarks, img_w, img_h, UPPER_LOWER_LIPS, LEFT_RIGHT_LIPS)

                # 4. Head Pose (Euler angles)
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

        # Update multi-student tracker
        summary = tracker.update(detected_faces)

        # Render HUD annotations on video image
        for track in tracker.tracks:
            if not track.is_active:
                continue
            # Find the detection that matched this track to get its landmark & pose vectors
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

        # In-place terminal status table (Fix 5.2 #5)
        print_ansi_status(fps, summary["count"], summary)

        # Atomic telemetry write throttled to 1 Hz (Fix 4.1)
        if now - last_json_time >= 1.0:
            write_atomic_json(summary)
            last_json_time = now

        # Update live camera stream frame for browser (10-15 Hz)
        if now - last_frame_feed_time >= 0.08:
            write_atomic_frame(image)
            last_frame_feed_time = now

        if display_window:
            cv.imshow(window_name, image)
            if cv.waitKey(1) & 0xFF == 27:  # Esc key
                break
        else:
            time.sleep(0.005)

    capture.release()
    if display_window:
        cv.destroyAllWindows()
    print("\n[CAMS] Tracking terminated cleanly.")


if __name__ == '__main__':
    main()
