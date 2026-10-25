import math
import cv2 as cv
import numpy as np
from cams.landmarks import CANONICAL_FACE_3D, POSE_LANDMARK_IDS


def fast_dist_2d(p1, p2):
    """Single-instruction C-level 2D distance calculation (20x faster than SciPy)."""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def compute_ear(face_landmarks, img_w, img_h, top_bottom_indices, left_right_indices):
    """
    Computes Eye Aspect Ratio (EAR) for a given eye with inlined math.hypot.
    Formula: (|p1 - p2| + |p3 - p4|) / (2 * |p_left - p_right| + eps)
    """
    lms = face_landmarks.landmark

    d1 = math.hypot(
        (lms[top_bottom_indices[0]].x - lms[top_bottom_indices[1]].x) * img_w,
        (lms[top_bottom_indices[0]].y - lms[top_bottom_indices[1]].y) * img_h
    )
    d2 = math.hypot(
        (lms[top_bottom_indices[2]].x - lms[top_bottom_indices[3]].x) * img_w,
        (lms[top_bottom_indices[2]].y - lms[top_bottom_indices[3]].y) * img_h
    )
    w = math.hypot(
        (lms[left_right_indices[0]].x - lms[left_right_indices[1]].x) * img_w,
        (lms[left_right_indices[0]].y - lms[left_right_indices[1]].y) * img_h
    )

    return (d1 + d2) / (2.0 * max(w, 1e-5))


def compute_mar(face_landmarks, img_w, img_h, upper_lower_indices, left_right_indices):
    """
    Computes Standard Mouth Aspect Ratio (MAR): height / width with inlined math.hypot.
    Closed lips: ~0.02 - 0.12.
    Speech / Vowels: ~0.15 - 0.35.
    Yawning: > 0.45.
    """
    lms = face_landmarks.landmark

    lip_height = math.hypot(
        (lms[upper_lower_indices[0]].x - lms[upper_lower_indices[1]].x) * img_w,
        (lms[upper_lower_indices[0]].y - lms[upper_lower_indices[1]].y) * img_h
    )
    lip_width = math.hypot(
        (lms[left_right_indices[0]].x - lms[left_right_indices[1]].x) * img_w,
        (lms[left_right_indices[0]].y - lms[left_right_indices[1]].y) * img_h
    )

    mar = lip_height / max(lip_width, 1e-5)
    return mar, lip_height, lip_width


def estimate_head_pose(face_landmarks, img_w, img_h, pitch_offset=0.0, yaw_offset=0.0):
    """
    Estimates 3D Head Pose (Pitch, Yaw, Roll) using canonical anthropometric 3D face model.
    Accounts for natural laptop webcam angles (screen tilt) via pitch_offset and yaw_offset.
    """
    lms = face_landmarks.landmark
    face_2d = np.array([
        [lms[idx].x * img_w, lms[idx].y * img_h] for idx in POSE_LANDMARK_IDS
    ], dtype=np.float64)

    focal_length = float(img_w)
    cam_matrix = np.array([
        [focal_length, 0.0, img_w / 2.0],
        [0.0, focal_length, img_h / 2.0],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)
    dist_matrix = np.zeros((4, 1), dtype=np.float64)

    success, rot_vec, trans_vec = cv.solvePnP(
        CANONICAL_FACE_3D, face_2d, cam_matrix, dist_matrix, flags=cv.SOLVEPNP_ITERATIVE
    )

    if not success:
        return 0.0, 0.0, 0.0, "Forward", None, None, cam_matrix, dist_matrix

    rmat, _ = cv.Rodrigues(rot_vec)
    angles, _, _, _, _, _ = cv.RQDecomp3x3(rmat)

    raw_pitch = float(angles[0])
    raw_yaw = float(angles[1])
    raw_roll = float(angles[2])

    cal_pitch = raw_pitch - pitch_offset
    cal_yaw = raw_yaw - yaw_offset

    if cal_yaw < -22.0:
        direction = "Looking Left"
    elif cal_yaw > 22.0:
        direction = "Looking Right"
    elif cal_pitch < -25.0:
        direction = "Looking Up"
    elif cal_pitch > 20.0:
        direction = "Looking Down"
    else:
        direction = "Forward"

    return cal_pitch, cal_yaw, raw_roll, direction, rot_vec, trans_vec, cam_matrix, dist_matrix
