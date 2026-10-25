import numpy as np
from collections import deque


class StudentTrack:
    """Maintains continuous tracking state, hysteresis counters, and smoothed metrics for a student."""

    def __init__(self, student_id):
        self.student_id = student_id
        self.centroid = None  # (cx, cy) normalized coordinates
        self.is_active = False
        self.missing_frames = 0

        # Metrics
        self.ear = 0.30
        self.mar = 3.50
        self.pitch = 0.0
        self.yaw = 0.0
        self.roll = 0.0
        self.direction = "Forward"

        # Hysteresis counters
        self.sleep_frame_count = 0
        self.yawn_frame_count = 0
        self.sleep_detected = False
        self.yawn_detected = False
        self.facing_classroom = True

        # Attention scoring
        self.instant_score = 100.0
        self.ema_score = 100.0
        self.is_attentive = True
        self.status = "Attentive"

    def reset(self):
        """Resets the track when student is no longer visible."""
        self.is_active = False
        self.centroid = None
        self.missing_frames = 0
        self.sleep_frame_count = 0
        self.yawn_frame_count = 0
        self.sleep_detected = False
        self.yawn_detected = False
        self.facing_classroom = False
        self.instant_score = 0.0
        self.ema_score = 0.0
        self.is_attentive = False
        self.status = "Empty Slot"

    def update(self, centroid, ear, mar, pitch, yaw, roll, direction):
        self.is_active = True
        self.missing_frames = 0
        self.centroid = centroid
        self.ear = ear
        self.mar = mar
        self.pitch = pitch
        self.yaw = yaw
        self.roll = roll
        self.direction = direction

        # Drowsiness detection with hysteresis (22 frames threshold)
        MIN_SLEEP_FRAMES = 22
        MIN_EAR_TOLERANCE = 0.22
        if ear < MIN_EAR_TOLERANCE:
            self.sleep_frame_count += 1
        else:
            self.sleep_frame_count = 0
        self.sleep_detected = (self.sleep_frame_count >= MIN_SLEEP_FRAMES)

        # Yawn detection with hysteresis (15 frames threshold)
        MIN_YAWN_FRAMES = 15
        MIN_MAR_TOLERANCE = 1.8
        if mar < MIN_MAR_TOLERANCE:
            self.yawn_frame_count += 1
        else:
            self.yawn_frame_count = 0
        self.yawn_detected = (self.yawn_frame_count >= MIN_YAWN_FRAMES)

        # Head orientation
        self.facing_classroom = (direction == "Forward")

        # Rebalanced weights
        if self.sleep_detected:
            w_sleep, w_facing, w_yawn = 0.70, 0.20, 0.10
        else:
            w_sleep, w_facing, w_yawn = 0.45, 0.35, 0.20

        s_sleep = 0.0 if self.sleep_detected else 100.0
        s_yawn = 0.0 if self.yawn_detected else 100.0
        s_facing = 100.0 if self.facing_classroom else 0.0

        self.instant_score = (s_sleep * w_sleep) + (s_yawn * w_yawn) + (s_facing * w_facing)

        # Smooth per-student score with Exponential Moving Average (alpha = 0.15)
        EMA_ALPHA = 0.15
        self.ema_score = (EMA_ALPHA * self.instant_score) + ((1.0 - EMA_ALPHA) * self.ema_score)

        # Determine status string
        if self.sleep_detected:
            self.status = "Sleeping"
        elif self.yawn_detected:
            self.status = "Yawning"
        elif not self.facing_classroom:
            self.status = direction
        else:
            self.status = "Attentive"

        # Strict Attentive Gate
        self.is_attentive = (
            self.ema_score >= 80.0 and self.facing_classroom and not self.sleep_detected
        )

    def to_dict(self):
        return {
            "id": self.student_id,
            "score": round(self.ema_score, 1),
            "ear": round(self.ear, 2),
            "mar": round(self.mar, 1),
            "yaw": round(self.yaw, 1),
            "pitch": round(self.pitch, 1),
            "status": self.status,
            "active": self.is_active
        }


class MultiStudentTracker:
    """
    Adaptive, auto-scaling multi-face tracker.
    Dynamically scales to any number of students detected in the room.
    """

    def __init__(self, max_faces=16, max_jump_radius=0.18, max_missing_frames=25):
        self.max_faces = max_faces
        self.max_jump_radius = max_jump_radius
        self.max_missing_frames = max_missing_frames
        self.tracks = {}  # student_id -> StudentTrack
        self.overall_history = deque(maxlen=900)

    def set_max_capacity(self, capacity):
        """Dynamically adjusts the maximum face capacity."""
        self.max_faces = max(1, int(capacity))

    def update(self, detected_faces):
        """
        detected_faces: list of dicts with detected face metrics
        """
        # Constrain to current max capacity
        num_detected = min(len(detected_faces), self.max_faces)
        matched_track_ids = set()
        matched_detections = set()

        # Step 1: Match active tracks to nearest detection
        for track_id, track in list(self.tracks.items()):
            if not track.is_active or track.centroid is None:
                continue

            best_det_idx = None
            best_dist = float("inf")

            for det_idx in range(num_detected):
                if det_idx in matched_detections:
                    continue
                det_c = detected_faces[det_idx]["centroid"]
                dist = np.hypot(track.centroid[0] - det_c[0], track.centroid[1] - det_c[1])
                if dist < best_dist and dist <= self.max_jump_radius:
                    best_dist = dist
                    best_det_idx = det_idx

            if best_det_idx is not None:
                d = detected_faces[best_det_idx]
                track.update(
                    d["centroid"], d["ear"], d["mar"], d["pitch"], d["yaw"], d["roll"], d["direction"]
                )
                matched_track_ids.add(track_id)
                matched_detections.add(best_det_idx)

        # Step 2: Handle unmatched detections (allocate new or reuse free IDs)
        unmatched_detections = [i for i in range(num_detected) if i not in matched_detections]

        for det_idx in unmatched_detections:
            # Find lowest available student ID
            new_id = 1
            while new_id in self.tracks and self.tracks[new_id].is_active:
                new_id += 1

            if new_id > self.max_faces:
                continue  # Capacity reached

            if new_id not in self.tracks:
                self.tracks[new_id] = StudentTrack(new_id)

            d = detected_faces[det_idx]
            self.tracks[new_id].update(
                d["centroid"], d["ear"], d["mar"], d["pitch"], d["yaw"], d["roll"], d["direction"]
            )
            matched_track_ids.add(new_id)

        # Step 3: Handle unmatched tracks (grace period before deactivating)
        for track_id, track in list(self.tracks.items()):
            if track_id not in matched_track_ids and track.is_active:
                track.missing_frames += 1
                if track.missing_frames > self.max_missing_frames:
                    track.reset()

        # Clean up empty tracks if total count exceeds 20
        if len(self.tracks) > 20:
            for tid in list(self.tracks.keys()):
                if not self.tracks[tid].is_active and tid > num_detected + 2:
                    del self.tracks[tid]

        # Active student metrics
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
