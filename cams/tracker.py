import math
import numpy as np
from collections import deque


class StudentTrack:
    """Maintains continuous tracking state, adaptive baseline, hysteresis, and smoothed metrics."""

    def __init__(self, student_id):
        self.student_id = student_id
        self.centroid = None  # (cx, cy) normalized coordinates
        self.is_active = False
        self.missing_frames = 0

        # Metrics
        self.ear = 0.28
        self.mar = 0.08
        self.pitch = 0.0
        self.yaw = 0.0
        self.roll = 0.0
        self.direction = "Forward"
        self.direction_candidate = "Forward"
        self.direction_candidate_frames = 0
        self.bbox = [0.0, 0.0, 0.0, 0.0]

        # Adaptive eye shape baseline
        self.ear_baseline = 0.28
        self.ear_history = deque(maxlen=60)

        # Hysteresis counters
        self.sleep_frame_count = 0
        self.yawn_frame_count = 0
        self.sleep_detected = False
        self.yawn_detected = False
        self.facing_classroom = True

        # Attention scoring & predictive kinematics
        self.instant_score = 100.0
        self.ema_score = 100.0
        self.prev_ema_score = 100.0
        self.attention_velocity = 0.0
        self.impending_divergence = False
        self.is_attentive = True
        self.status = "Attentive"

    def reset(self):
        self.is_active = False
        self.centroid = None
        self.missing_frames = 0
        self.sleep_frame_count = 0
        self.yawn_frame_count = 0
        self.sleep_detected = False
        self.yawn_detected = False
        self.facing_classroom = False
        self.direction = "Forward"
        self.direction_candidate = "Forward"
        self.direction_candidate_frames = 0
        self.bbox = [0.0, 0.0, 0.0, 0.0]
        self.instant_score = 0.0
        self.ema_score = 0.0
        self.is_attentive = False
        self.status = "Empty Slot"

    def update(self, centroid, ear, mar, pitch, yaw, roll, direction, bbox=None):
        self.is_active = True
        self.missing_frames = 0
        self.centroid = centroid
        self.ear = ear
        self.mar = mar
        self.pitch = pitch
        self.yaw = yaw
        self.roll = roll
        if bbox is not None:
            self.bbox = bbox

        # Dominant head orientation with Schmitt-trigger deadband (22° to exit forward, 18° to return)
        dev_yaw = abs(yaw)
        dev_pitch = abs(pitch)
        max_dev = max(dev_yaw, dev_pitch)

        if self.facing_classroom:
            is_forward = (max_dev < 22.0)
        else:
            is_forward = (max_dev < 18.0)

        if is_forward:
            self.direction = "Forward"
        elif dev_pitch >= dev_yaw:
            self.direction = "Looking Down" if pitch > 0 else "Looking Up"
        else:
            self.direction = "Looking Right" if yaw > 0 else "Looking Left"

        # Adaptive EAR baseline (tracks user's natural open-eye ratio)
        if ear > 0.16:
            self.ear_history.append(ear)
            if len(self.ear_history) >= 15:
                # Use 75th percentile as open-eye baseline
                self.ear_baseline = float(np.percentile(self.ear_history, 75))

        # Dynamic sleep threshold: 68% of open-eye baseline (bounded between 0.14 and 0.21 to align with UI 0.20 alert gate)
        dynamic_ear_threshold = max(min(self.ear_baseline * 0.68, 0.21), 0.14)

        # Yawn detection with temporal hysteresis (MAR >= 0.40 sustained for 6 frames)
        MIN_YAWN_FRAMES = 6
        YAWN_MAR_THRESHOLD = 0.40
        if mar >= YAWN_MAR_THRESHOLD:
            self.yawn_frame_count += 1
        else:
            self.yawn_frame_count = max(0, self.yawn_frame_count - 1)
        self.yawn_detected = (self.yawn_frame_count >= MIN_YAWN_FRAMES)

        # Drowsiness detection with hysteresis (20 frames threshold)
        # Biological note: Involuntary eyelid squinting during an active yawn (MAR >= 0.38)
        # is a facial muscle synkinesis, NOT sleep. Suppress false sleep accumulation during yawning.
        is_yawning_now = bool(self.yawn_detected or mar >= 0.38 or self.yawn_frame_count > 0)
        MIN_SLEEP_FRAMES = 20
        if ear < dynamic_ear_threshold and not is_yawning_now:
            self.sleep_frame_count += 1
        else:
            self.sleep_frame_count = max(0, self.sleep_frame_count - 2)
        self.sleep_detected = (self.sleep_frame_count >= MIN_SLEEP_FRAMES)

        # Head orientation
        self.facing_classroom = (self.direction == "Forward")

        # Instantaneous score weights
        if self.sleep_detected:
            w_sleep, w_facing, w_yawn = 0.70, 0.20, 0.10
        elif self.yawn_detected or mar >= 0.42:
            w_sleep, w_facing, w_yawn = 0.20, 0.20, 0.60
        else:
            w_sleep, w_facing, w_yawn = 0.45, 0.35, 0.20

        s_sleep = 0.0 if self.sleep_detected else 100.0
        s_yawn = 0.0 if (self.yawn_detected or mar >= 0.42) else 100.0
        s_facing = 100.0 if self.facing_classroom else 0.0

        self.instant_score = (s_sleep * w_sleep) + (s_yawn * w_yawn) + (s_facing * w_facing)

        # Asymmetric Kinematic Damper:
        # Fast-attack on genuine distraction / drowsiness (alpha = 0.35)
        # Calm decay on recovery to baseline (alpha = 0.12) to eliminate eye-blink / micro-twitch jitter
        if self.instant_score < self.ema_score:
            alpha = 0.35
        else:
            alpha = 0.12

        self.prev_ema_score = self.ema_score
        self.ema_score = (alpha * self.instant_score) + ((1.0 - alpha) * self.ema_score)

        # 1st-order attention derivative (velocity: % change per frame)
        self.attention_velocity = round(self.ema_score - self.prev_ema_score, 2)
        self.impending_divergence = bool(self.attention_velocity < -3.0 and not self.facing_classroom)

        # Determine semantic status with priority to primary biomechanical events
        if self.yawn_detected or mar >= 0.42:
            self.status = "Yawning"
        elif self.sleep_detected:
            self.status = "Sleeping"
        elif not self.facing_classroom:
            self.status = self.direction
        elif self.ema_score < 45.0:
            self.status = "Distracted"
        elif self.ema_score < 70.0:
            self.status = "Passive"
        else:
            self.status = "Attentive"

        # Strict Attentive Gate
        self.is_attentive = (
            self.ema_score >= 70.0 and self.facing_classroom and not self.sleep_detected and not self.yawn_detected
        )

    def to_dict(self):
        cx, cy = (round(self.centroid[0], 3), round(self.centroid[1], 3)) if self.centroid else (0.5, 0.5)
        pos = "Center"
        if cx < 0.35:
            pos = "Left"
        elif cx > 0.65:
            pos = "Right"

        return {
            "id": self.student_id,
            "score": round(self.ema_score, 1),
            "velocity": self.attention_velocity,
            "impending_divergence": self.impending_divergence,
            "ear": round(self.ear, 2),
            "mar": round(self.mar, 2),
            "yaw": round(self.yaw, 1),
            "pitch": round(self.pitch, 1),
            "roll": round(self.roll, 1),
            "status": self.status,
            "direction": self.direction,
            "active": self.is_active,
            "missing_frames": self.missing_frames,
            "centroid": [cx, cy],
            "position": pos,
            "bbox": self.bbox
        }


class MultiStudentTracker:
    """
    Adaptive multi-student tracker with ID stability, auto-centering, and capacity management.
    """

    def __init__(self, max_faces=16, max_jump_radius=0.25, max_missing_frames=30):
        self.max_faces = max_faces
        self.max_jump_radius = max_jump_radius
        self.max_missing_frames = max_missing_frames
        self.tracks = {}  # student_id -> StudentTrack
        self.overall_history = deque(maxlen=900)

        # Calibration offsets (for laptop webcam tilt)
        self.pitch_offset = 0.0
        self.yaw_offset = 0.0

    def set_calibration(self, pitch_offset, yaw_offset):
        self.pitch_offset = float(pitch_offset)
        self.yaw_offset = float(yaw_offset)

    def set_max_capacity(self, capacity):
        self.max_faces = max(1, int(capacity))

    def update(self, detected_faces):
        num_detected = min(len(detected_faces), self.max_faces)
        matched_track_ids = set()
        matched_detections = set()

        # If only 1 face detected and we have ID #1, prefer keeping ID #1
        if num_detected == 1 and 1 in self.tracks and self.tracks[1].is_active:
            d = detected_faces[0]
            self.tracks[1].update(
                d["centroid"], d["ear"], d["mar"], d["pitch"], d["yaw"], d["roll"], d["direction"], d.get("bbox")
            )
            matched_track_ids.add(1)
            matched_detections.add(0)

        # Step 1: Match active tracks by nearest centroid
        for track_id, track in list(self.tracks.items()):
            if track_id in matched_track_ids or not track.is_active or track.centroid is None:
                continue

            best_det_idx = None
            best_dist = float("inf")

            for det_idx in range(num_detected):
                if det_idx in matched_detections:
                    continue
                det_c = detected_faces[det_idx]["centroid"]
                dist = math.hypot(track.centroid[0] - det_c[0], track.centroid[1] - det_c[1])
                if dist < best_dist and dist <= self.max_jump_radius:
                    best_dist = dist
                    best_det_idx = det_idx

            if best_det_idx is not None:
                d = detected_faces[best_det_idx]
                track.update(
                    d["centroid"], d["ear"], d["mar"], d["pitch"], d["yaw"], d["roll"], d["direction"], d.get("bbox")
                )
                matched_track_ids.add(track_id)
                matched_detections.add(best_det_idx)

        # Step 2: Allocate unmatched detections
        unmatched_detections = [i for i in range(num_detected) if i not in matched_detections]

        for det_idx in unmatched_detections:
            new_id = 1
            while new_id in self.tracks and self.tracks[new_id].is_active:
                new_id += 1

            if new_id > self.max_faces:
                continue

            if new_id not in self.tracks:
                self.tracks[new_id] = StudentTrack(new_id)

            d = detected_faces[det_idx]
            self.tracks[new_id].update(
                d["centroid"], d["ear"], d["mar"], d["pitch"], d["yaw"], d["roll"], d["direction"], d.get("bbox")
            )
            matched_track_ids.add(new_id)

        # Step 3: Handle unmatched tracks (grace period)
        for track_id, track in list(self.tracks.items()):
            if track_id not in matched_track_ids and track.is_active:
                track.missing_frames += 1
                if track.missing_frames > self.max_missing_frames:
                    track.reset()

        active_tracks = [t for t in self.tracks.values() if t.is_active]
        active_tracks.sort(key=lambda t: t.student_id)
        active_count = len(active_tracks)

        if active_count > 0:
            avg_attention = sum(t.ema_score for t in active_tracks) / active_count
            attention_count = sum(1 for t in active_tracks if t.is_attentive)
            sleep_pct = (sum(1 for t in active_tracks if t.sleep_detected) / active_count) * 100.0
            yawn_pct = (sum(1 for t in active_tracks if t.yawn_detected) / active_count) * 100.0
            facing_pct = (sum(1 for t in active_tracks if t.facing_classroom) / active_count) * 100.0
        else:
            avg_attention = 0.0
            attention_count = 0
            sleep_pct = 0.0
            yawn_pct = 0.0
            facing_pct = 0.0

        self.overall_history.append(avg_attention)
        session_overall = sum(self.overall_history) / max(len(self.overall_history), 1)

        summary = {
            "count": active_count,
            "attention_scores": round(avg_attention, 1),
            "attention_count": attention_count,
            "sleep_detected": round(sleep_pct, 1),
            "yawn_detected": round(yawn_pct, 1),
            "facing_classroom": round(facing_pct, 1),
            "overall_score": round(session_overall, 2),
            "students": [t.to_dict() for t in active_tracks]
        }
        return summary
