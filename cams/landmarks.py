import numpy as np

# Eye landmark indices for EAR
# [top_1, bottom_1, top_2, bottom_2]
LEFT_EYE_TOP_BOTTOM = [386, 374, 385, 380]
LEFT_EYE_LEFT_RIGHT = [263, 362]

RIGHT_EYE_TOP_BOTTOM = [160, 144, 158, 153]
RIGHT_EYE_LEFT_RIGHT = [133, 33]

# Lips landmark indices for MAR
UPPER_LOWER_LIPS = [13, 14]
LEFT_RIGHT_LIPS = [78, 308]

# 6 Canonical facial landmarks for Head Pose Estimation:
# Landmark 1: Nose tip
# Landmark 199: Chin
# Landmark 33: Left eye outer corner
# Landmark 263: Right eye outer corner
# Landmark 61: Left mouth corner
# Landmark 291: Right mouth corner
POSE_LANDMARK_IDS = [1, 199, 33, 263, 61, 291]

# Canonical anthropometric 3D face model coordinates (in millimeters)
# Aligned with OpenCV camera coordinates (+X right, +Y down, +Z forward):
CANONICAL_FACE_3D = np.array([
    [0.0, 0.0, 0.0],          # Nose tip (Landmark 1)
    [0.0, 330.0, -65.0],       # Chin (Landmark 199)
    [-225.0, -170.0, -135.0],  # Left eye corner (Landmark 33)
    [225.0, -170.0, -135.0],   # Right eye corner (Landmark 263)
    [-150.0, 150.0, -125.0],   # Left mouth corner (Landmark 61)
    [150.0, 150.0, -125.0],    # Right mouth corner (Landmark 291)
], dtype=np.float64)

# Future V2.0 iris landmark indices (MediaPipe refine_landmarks=True)
LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]
