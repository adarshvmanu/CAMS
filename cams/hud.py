import cv2 as cv
import numpy as np


def draw_corner_brackets(image, bbox, color, length=18, thickness=2):
    """Draws sleek corner-bracket bounding boxes instead of full rigid rectangles."""
    x, y, w, h = bbox
    # Top-Left
    cv.line(image, (x, y), (x + length, y), color, thickness)
    cv.line(image, (x, y), (x, y + length), color, thickness)

    # Top-Right
    cv.line(image, (x + w, y), (x + w - length, y), color, thickness)
    cv.line(image, (x + w, y), (x + w, y + length), color, thickness)

    # Bottom-Left
    cv.line(image, (x, y + h), (x + length, y + h), color, thickness)
    cv.line(image, (x, y + h), (x, y + h - length), color, thickness)

    # Bottom-Right
    cv.line(image, (x + w, y + h), (x + w - length, y + h), color, thickness)
    cv.line(image, (x + w, y + h), (x + w, y + h - length), color, thickness)


def render_student_overlay(image, track, face_landmarks, rot_vec, trans_vec, cam_matrix, dist_matrix):
    """Renders student ID badge, status tag, and 3D gaze vector."""
    img_h, img_w = image.shape[:2]

    # Calculate 2D bounding box from facial landmarks
    x_coords = [int(lm.x * img_w) for lm in face_landmarks.landmark]
    y_coords = [int(lm.y * img_h) for lm in face_landmarks.landmark]

    min_x, max_x = max(min(x_coords) - 10, 0), min(max(x_coords) + 10, img_w - 1)
    min_y, max_y = max(min(y_coords) - 15, 0), min(max(y_coords) + 10, img_h - 1)
    box_w = max_x - min_x
    box_h = max_y - min_y

    # Determine status color
    if track.sleep_detected:
        color = (94, 63, 244)   # Rose / Critical: #F43F5E (BGR: 94, 63, 244)
    elif track.yawn_detected or not track.facing_classroom or track.ema_score < 80.0:
        color = (11, 158, 245)  # Amber / Warning: #F59E0B (BGR: 11, 158, 245)
    else:
        color = (129, 185, 16)  # Emerald / Good: #10B981 (BGR: 129, 185, 16)

    # Draw corner brackets
    draw_corner_brackets(image, (min_x, min_y, box_w, box_h), color, length=20, thickness=2)

    # Draw 3D Nose Direction Vector if rot_vec is available
    if rot_vec is not None and trans_vec is not None:
        nose_lm = face_landmarks.landmark[1]
        nose_2d = (int(nose_lm.x * img_w), int(nose_lm.y * img_h))
        # Project 3D vector forward from nose
        p2 = (int(nose_2d[0] + track.yaw * 3.5), int(nose_2d[1] - track.pitch * 3.5))
        cv.line(image, nose_2d, p2, color, 2, cv.LINE_AA)
        cv.circle(image, nose_2d, 3, color, -1)


def render_top_bar(image, fps, active_count, overall_score):
    """Draws top telemetry bar on camera feed."""
    img_h, img_w = image.shape[:2]
    # Semi-transparent overlay top banner
    overlay = image.copy()
    cv.rectangle(overlay, (0, 0), (img_w, 36), (15, 23, 42), cv.FILLED)
    cv.addWeighted(overlay, 0.85, image, 0.15, 0, image)

    info_text = f"CAMS Live  |  FPS: {fps:.1f}  |  Students: {active_count}  |  Class Attention: {overall_score:.1f}%"
    cv.putText(image, info_text, (15, 24), cv.FONT_HERSHEY_SIMPLEX, 0.55, (248, 250, 252), 1, cv.LINE_AA)


def print_ansi_status(fps, active_count, summary):
    """Prints a clean in-place ANSI terminal status table without scrolling."""
    students = summary.get("students", [])
    student_summaries = []
    for s in students:
        if s.get("active"):
            student_summaries.append(f"#{s['id']}: {s['score']:.0f}% ({s['status']})")

    details = " | ".join(student_summaries) if student_summaries else "No students in view"
    line = f"\r\033[K[CAMS] FPS: {fps:4.1f} | Active: {active_count} | Class Score: {summary.get('overall_score', 0):.1f}% | {details}"
    print(line, end="", flush=True)
