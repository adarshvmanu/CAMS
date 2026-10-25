import cv2 as cv
import numpy as np
from scipy.spatial import distance as dis
from cams.landmarks import CANONICAL_FACE_3D, POSE_LANDMARK_IDS


def euclidean_distance_2d(p1, p2):
    """Calculates Euclidean distance between two (x, y) coordinate pairs."""
    return dis.euclidean(p1, p2)


def get_landmark_point(landmark, img_w, img_h):
    """Converts normalized landmark to integer pixel coordinates."""
    return int(landmark.x * img_w), int(landmark.y * img_h)


def compute_ear(face_landmarks, img_w, img_h, top_bottom_indices, left_right_indices):
    """
    Computes Eye Aspect Ratio (EAR) for a given eye.
    Standard formula: (|p1 - p2| + |p3 - p4|) / (2 * |p_left - p_right| + eps)
    """
    p1 = get_landmark_point(face_landmarks.landmark[top_bottom_indices[0]], img_w, img_h)
    p2 = get_landmark_point(face_landmarks.landmark[top_bottom_indices[1]], img_w, img_h)
    d1 = euclidean_distance_2d(p1, p2)

    p3 = get_landmark_point(face_landmarks.landmark[top_bottom_indices[2]], img_w, img_h)
    p4 = get_landmark_point(face_landmarks.landmark[top_bottom_indices[3]], img_w, img_h)
    d2 = euclidean_distance_2d(p3, p4)

    p_left = get_landmark_point(face_landmarks.landmark[left_right_indices[0]], img_w, img_h)
    p_right = get_landmark_point(face_landmarks.landmark[left_right_indices[1]], img_w, img_h)
    w = euclidean_distance_2d(p_left, p_right)

    return (d1 + d2) / (2.0 * max(w, 1e-5))


def compute_mar(face_landmarks, img_w, img_h, upper_lower_indices, left_right_indices):
    """
    Computes Mouth Aspect Ratio (MAR) with zero-division protection.
    ratio_lips = lip_width / max(lip_height, 1e-5)
    In this formulation, yawning opens the mouth vertically, decreasing ratio_lips below 1.8.
    """
    p_top = get_landmark_point(face_landmarks.landmark[upper_lower_indices[0]], img_w, img_h)
    p_bottom = get_landmark_point(face_landmarks.landmark[upper_lower_indices[1]], img_w, img_h)
    lip_height = euclidean_distance_2d(p_top, p_bottom)

    p_left = get_landmark_point(face_landmarks.landmark[left_right_indices[0]], img_w, img_h)
    p_right = get_landmark_point(face_landmarks.landmark[left_right_indices[1]], img_w, img_h)
    lip_width = euclidean_distance_2d(p_left, p_right)

    ratio_lips = lip_width / max(lip_height, 1e-5)
    return ratio_lips, lip_height, lip_width


def estimate_head_pose(face_landmarks, img_w, img_h):
    """
    Estimates 3D Head Pose (Pitch, Yaw, Roll) using canonical anthropometric 3D face points.
    Camera matrix uses correct optical center: cx = img_w / 2, cy = img_h / 2.
    cv.RQDecomp3x3 returns Euler angles in degrees.
    """
    face_2d = []
    for idx in POSE_LANDMARK_IDS:
        lm = face_landmarks.landmark[idx]
        face_2d.append([lm.x * img_w, lm.y * img_h])
    face_2d = np.array(face_2d, dtype=np.float64)

    focal_length = float(img_w)
    cam_matrix = np.array([
        [focal_length, 0.0, img_w / 2.0],  # Fixed: cx = img_w / 2
        [0.0, focal_length, img_h / 2.0],  # Fixed: cy = img_h / 2
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

    # RQDecomp3x3 returns angles directly in degrees
    pitch = float(angles[0])
    yaw = float(angles[1])
    roll = float(angles[2])

    if yaw < -10.0:
        direction = "Looking Left"
    elif yaw > 10.0:
        direction = "Looking Right"
    elif pitch < -10.0:
        direction = "Looking Up"
    elif pitch > 15.0:
        direction = "Looking Down"
    else:
        direction = "Forward"

    return pitch, yaw, roll, direction, rot_vec, trans_vec, cam_matrix, dist_matrix
