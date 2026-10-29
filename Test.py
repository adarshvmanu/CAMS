"""
CAMS Test Suite - Automated Verification of CV Detectors & MultiStudentTracker
"""
import unittest
import numpy as np
from cams.landmarks import CANONICAL_FACE_3D, POSE_LANDMARK_IDS
from cams.tracker import MultiStudentTracker, StudentTrack


class TestCAMSComponents(unittest.TestCase):

    def test_canonical_face_model(self):
        self.assertEqual(CANONICAL_FACE_3D.shape, (6, 3))
        self.assertEqual(len(POSE_LANDMARK_IDS), 6)

    def test_student_track_rebalancing(self):
        track = StudentTrack(student_id=1)
        # 1. Normal attentive student (facing, eyes open, mouth closed)
        track.update(
            centroid=(0.5, 0.5), ear=0.28, mar=0.08,
            pitch=0.0, yaw=0.0, roll=0.0, direction="Forward"
        )
        self.assertAlmostEqual(track.instant_score, 100.0, delta=1.0)
        self.assertTrue(track.is_attentive)
        self.assertEqual(track.status, "Attentive")

        # 2. Distracted student looking completely away
        track.update(
            centroid=(0.5, 0.5), ear=0.28, mar=0.08,
            pitch=0.0, yaw=30.0, roll=0.0, direction="Looking Right"
        )
        self.assertAlmostEqual(track.instant_score, 65.0, delta=1.0)
        self.assertFalse(track.facing_classroom)
        self.assertEqual(track.status, "Looking Right")

    def test_yawn_hysteresis(self):
        track = StudentTrack(student_id=1)
        # Single frame with wide open mouth (mar > 0.45) should NOT immediately trigger yawn
        track.update(
            centroid=(0.5, 0.5), ear=0.28, mar=0.55,
            pitch=0.0, yaw=0.0, roll=0.0, direction="Forward"
        )
        self.assertFalse(track.yawn_detected)
        self.assertEqual(track.yawn_frame_count, 1)

        # After 15 sustained frames, yawn triggers
        for _ in range(15):
            track.update(
                centroid=(0.5, 0.5), ear=0.28, mar=0.55,
                pitch=0.0, yaw=0.0, roll=0.0, direction="Forward"
            )
        self.assertTrue(track.yawn_detected)
        self.assertEqual(track.status, "Yawning")

    def test_asymmetric_kinematic_damper(self):
        track = StudentTrack(student_id=1)
        # Establish attentive baseline at 100
        track.update(
            centroid=(0.5, 0.5), ear=0.28, mar=0.08,
            pitch=0.0, yaw=0.0, roll=0.0, direction="Forward"
        )
        self.assertEqual(track.ema_score, 100.0)

        # Distraction / Sleep onset: fast-attack (alpha = 0.35)
        # Instant score drops to 0.0
        track.sleep_detected = True
        track.facing_classroom = False
        track.instant_score = 0.0
        track.prev_ema_score = track.ema_score
        alpha_down = 0.35
        expected_down = (alpha_down * 0.0) + ((1.0 - alpha_down) * 100.0)  # 65.0
        track.ema_score = expected_down
        track.attention_velocity = round(track.ema_score - track.prev_ema_score, 2)
        track.impending_divergence = bool(track.attention_velocity < -3.0 and not track.facing_classroom)

        self.assertAlmostEqual(track.ema_score, 65.0, delta=0.1)
        self.assertEqual(track.attention_velocity, -35.0)
        self.assertTrue(track.impending_divergence)

        # Recovery back to attentive: calm decay (alpha = 0.12)
        track.instant_score = 100.0
        alpha_up = 0.12
        expected_up = (alpha_up * 100.0) + ((1.0 - alpha_up) * 65.0)  # 12.0 + 57.2 = 69.2
        track.prev_ema_score = track.ema_score
        track.ema_score = expected_up
        self.assertAlmostEqual(track.ema_score, 69.2, delta=0.1)

    def test_yawn_with_eye_squint_suppresses_false_sleep(self):
        track = StudentTrack(student_id=1)
        # Simulate active yawn (MAR 0.51) where eyes reflexively squint (EAR 0.15)
        for _ in range(10):
            track.update(
                centroid=(0.5, 0.5), ear=0.15, mar=0.51,
                pitch=0.0, yaw=0.0, roll=0.0, direction="Forward"
            )
        # Should be classified as Yawning, NOT Sleeping
        self.assertTrue(track.yawn_detected)
        self.assertFalse(track.sleep_detected)
        self.assertEqual(track.status, "Yawning")

    def test_status_tiering_prevents_false_attentive(self):
        track = StudentTrack(student_id=1)
        # Student facing forward but heavily distracted (EMA drops to 13.6)
        track.ema_score = 13.6
        track.facing_classroom = True
        track.update(
            centroid=(0.5, 0.5), ear=0.28, mar=0.08,
            pitch=0.0, yaw=0.0, roll=0.0, direction="Forward"
        )
        self.assertFalse(track.is_attentive)
        self.assertEqual(track.status, "Distracted")

    def test_student_track_dictionary_serialization(self):
        track = StudentTrack(student_id=1)
        track.update(
            centroid=(0.52, 0.48), ear=0.25, mar=0.09,
            pitch=12.0, yaw=-5.0, roll=2.0, direction="Forward",
            bbox=[0.40, 0.35, 0.22, 0.28]
        )
        d = track.to_dict()
        self.assertEqual(d["id"], 1)
        self.assertEqual(d["position"], "Center")
        self.assertEqual(d["missing_frames"], 0)
        self.assertTrue(d["active"])
        self.assertIn("score", d)
        self.assertIn("velocity", d)
        self.assertIn("impending_divergence", d)
        self.assertEqual(d["bbox"], [0.40, 0.35, 0.22, 0.28])

    def test_dynamic_ear_threshold_bounds(self):
        track = StudentTrack(student_id=1)
        # Test low baseline
        for _ in range(20):
            track.update((0.5, 0.5), 0.18, 0.08, 0.0, 0.0, 0.0, "Forward")
        # Should be bounded at >= 0.14
        dyn_low = max(min(track.ear_baseline * 0.68, 0.21), 0.14)
        self.assertGreaterEqual(dyn_low, 0.14)

        # Test high baseline
        for _ in range(40):
            track.update((0.5, 0.5), 0.38, 0.08, 0.0, 0.0, 0.0, "Forward")
        dyn_high = max(min(track.ear_baseline * 0.68, 0.21), 0.14)
        self.assertLessEqual(dyn_high, 0.21)

    def test_multistudent_tracker_slot_reset(self):
        tracker = MultiStudentTracker(max_faces=4)
        # Simulate 2 detected faces
        faces = [
            {"centroid": (0.2, 0.4), "ear": 0.28, "mar": 0.08, "pitch": 0.0, "yaw": 0.0, "roll": 0.0, "direction": "Forward"},
            {"centroid": (0.7, 0.4), "ear": 0.29, "mar": 0.08, "pitch": 0.0, "yaw": 0.0, "roll": 0.0, "direction": "Forward"}
        ]
        summary = tracker.update(faces)
        self.assertEqual(summary["count"], 2)
        self.assertTrue(tracker.tracks[1].is_active)
        self.assertTrue(tracker.tracks[2].is_active)

        # Simulate 1 face in next frame (grace period before reset)
        faces_next = [
            {"centroid": (0.2, 0.4), "ear": 0.28, "mar": 0.08, "pitch": 0.0, "yaw": 0.0, "roll": 0.0, "direction": "Forward"}
        ]
        # Fast forward missing frames to trigger reset
        for _ in range(35):
            summary_next = tracker.update(faces_next)

        self.assertEqual(summary_next["count"], 1)
        self.assertTrue(tracker.tracks[1].is_active)
        self.assertFalse(tracker.tracks[2].is_active)


if __name__ == '__main__':
    unittest.main()
