"""
CAMS Unified Vision Pipeline
Consolidates capture, MediaPipe FaceMesh processing, multi-student tracking, and HUD rendering.
"""
import time
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


class CAMSPipeline:
    """
    High-performance, zero-copy vision pipeline for Classroom Attention Monitoring.
    """

    def __init__(self, max_faces=16, pitch_offset=0.0, yaw_offset=0.0):
        self.max_faces = max_faces
        self.pitch_offset = pitch_offset
        self.yaw_offset = yaw_offset

        # MediaPipe FaceMesh (CPU / Metal optimized)
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_model = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=max_faces,
            refine_landmarks=False,
            min_detection_confidence=0.55,
            min_tracking_confidence=0.55
        )

        self.tracker = MultiStudentTracker(max_faces=max_faces, max_jump_radius=0.25)
        self.tracker.set_calibration(pitch_offset, yaw_offset)

        # FPS calculation state
        self.frame_count = 0
        self.fps = 30.0
        self.t_start = time.time()

    def set_calibration(self, pitch_offset, yaw_offset):
        self.pitch_offset = float(pitch_offset)
        self.yaw_offset = float(yaw_offset)
        self.tracker.set_calibration(self.pitch_offset, self.yaw_offset)

    def set_max_capacity(self, capacity):
        self.max_faces = max(1, int(capacity))
        self.tracker.set_max_capacity(self.max_faces)

    def process_frame(self, image, draw_hud=True):
        """
        Processes a single BGR camera frame with zero-copy buffer passing.
        Returns: (annotated_image, summary_dict, fps)
        """
        self.frame_count += 1
        now = time.time()
        if self.frame_count % 15 == 0:
            elapsed = now - self.t_start
            if elapsed > 0:
                self.fps = 15.0 / elapsed
            self.t_start = now

        img_h, img_w = image.shape[:2]

        # Zero-copy optimization for MediaPipe C++ core
        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        image_rgb.flags.writeable = False
        results = self.face_model.process(image_rgb)
        image_rgb.flags.writeable = True

        detected_faces = []

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                nose_lm = face_landmarks.landmark[1]
                centroid = (nose_lm.x, nose_lm.y)

                # EAR
                ear_left = compute_ear(face_landmarks, img_w, img_h, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)
                ear_right = compute_ear(face_landmarks, img_w, img_h, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)
                ear_avg = (ear_left + ear_right) / 2.0

                # Standard MAR
                mar, _, _ = compute_mar(face_landmarks, img_w, img_h, UPPER_LOWER_LIPS, LEFT_RIGHT_LIPS)

                # Normalized Bounding Box for High-DPI Reticle Overlay
                x_coords = [lm.x for lm in face_landmarks.landmark]
                y_coords = [lm.y for lm in face_landmarks.landmark]
                min_x = max(0.0, min(x_coords) - 0.02)
                max_x = min(1.0, max(x_coords) + 0.02)
                min_y = max(0.0, min(y_coords) - 0.03)
                max_y = min(1.0, max(y_coords) + 0.02)
                bbox = [round(min_x, 4), round(min_y, 4), round(max_x - min_x, 4), round(max_y - min_y, 4)]

                # Calibrated Head Pose
                pitch, yaw, roll, direction, rot_vec, trans_vec, cam_matrix, dist_matrix = estimate_head_pose(
                    face_landmarks, img_w, img_h,
                    pitch_offset=self.pitch_offset,
                    yaw_offset=self.yaw_offset
                )

                detected_faces.append({
                    "centroid": centroid,
                    "bbox": bbox,
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

        summary = self.tracker.update(detected_faces)

        # Draw overlays
        if draw_hud:
            for track in self.tracker.tracks.values():
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

        return image, summary, self.fps
