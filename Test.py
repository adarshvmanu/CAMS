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
