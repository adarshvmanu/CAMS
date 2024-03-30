import mediapipe as mp
import cv2 as cv
import time
import numpy as np


face_mesh = mp.solutions.face_mesh
draw_utils = mp.solutions.drawing_utils
landmark_style = draw_utils.DrawingSpec((0,255,0), thickness=1, circle_radius=1)
connection_style = draw_utils.DrawingSpec((0,0,255), thickness=1, circle_radius=1)


mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

STATIC_IMAGE_MODE = False
MAX_NUM_FACES = 5
DETECTION_CONFIDENCE = 0.6
TRACKING_CONFIDENCE = 0.6


face_model = mp_face_mesh.FaceMesh(
    static_image_mode=STATIC_IMAGE_MODE,
    max_num_faces=MAX_NUM_FACES,
    min_detection_confidence=DETECTION_CONFIDENCE,
    min_tracking_confidence=TRACKING_CONFIDENCE)

capture = cv.VideoCapture(0)


min_frame = 6
min_tolerance = 5.0

while True:
    ret, image = capture.read()
    if not ret:
        break

    image =cv.flip(image, 1)
    image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
    results = face_model.process(image_rgb)
    img_h, img_w, img_c = image.shape

    text=[]
    if results.multi_face_landmarks:
        for face_landmarks in (results.multi_face_landmarks):
            face_2d = np.empty((0, 2), dtype=np.float64)
            face_3d = np.empty((0, 3), dtype=np.float64)
            for idx, lm in enumerate(face_landmarks.landmark):
                if idx == 33 or idx == 263 or idx == 1 or idx == 61 or idx == 291 or idx == 199:
                    if idx == 1:
                        nose_2d = (lm.x * img_w, lm.y * img_h)
                        nose_3d = (lm.x * img_w, lm.y * img_h, lm.z * 3000)

                    x, y = int(lm.x * img_w), int(lm.y * img_h)

                    face_2d = np.vstack([face_2d, [x, y]])

                    face_3d = np.vstack([face_3d, [x, y, lm.z]])                        

            #Converting to numpy arrays
            face_2d = np.array(face_2d, dtype=np.float64)
            face_3d = np.array(face_3d, dtype=np.float64)

            #Camera
            focal_length = 1 * img_w

            #Camera Matrix and Distance Matrix
            cam_matrix = np.array([ [focal_length, 0, img_h / 2],
                                    [0, focal_length, img_w / 2],
                                    [0, 0, 1]])
            dist_matrix = np.zeros((4, 1), dtype=np.float64)


            success, rot_vec, trans_vec = cv.solvePnP(face_3d, face_2d, cam_matrix, dist_matrix)
            rmat, jac = cv.Rodrigues(rot_vec)
            angles, mtxR, mtxQ, Qx, Qy, Qz = cv.RQDecomp3x3(rmat)

            x = angles[0] * 360
            y = angles[1] * 360
            z = angles[2] * 360

            if y < -10:
                text.append("Left")
            elif y > 10:
                text.append("Right")
            elif x < -10:
                text.append("Down")
            elif x > 15:
                text.append("Up")
            else:
                text.append("Forward")

            # Display the nose direction
            nose_3d_projection, jacobian = cv.projectPoints(nose_3d, rot_vec, trans_vec, cam_matrix, dist_matrix)

            p1 = (int(nose_2d[0]), int(nose_2d[1]))
            p2 = (int(nose_2d[0] + y * 10) , int(nose_2d[1] - x * 10))
            
            cv.line(image, p1, p2, (255, 0, 0), 3)  
                    
        timestamp = time.strftime("%H:%M:%S")
        print(f"{timestamp}")
        for idx, t in enumerate(text):
             print(f"{idx+1} is Looking {text[idx]}")
               

    cv.imshow('Head Pose', image)
    if cv.waitKey(5) & 0xFF == 27:
        break
    

capture.release()
cv.destroyAllWindows()