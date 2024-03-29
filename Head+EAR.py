import mediapipe as mp
import cv2 as cv
from scipy.spatial import distance as dis
import time
import numpy as np

def draw_landmarks(image, outputs, land_mark, color):
    height, width = image.shape[:2]
             
    for idx, face_landmarks in enumerate(outputs.multi_face_landmarks):
        for face in land_mark:
            point = face_landmarks.landmark[face]
            point_scale = ((int)(point.x * width), (int)(point.y*height))
            cv.circle(image, point_scale, 2, color, 1)
            
def euclidean_distance(image, top, bottom):
    height, width = image.shape[0:2]
            
    point1 = int(top.x * width), int(top.y * height)
    point2 = int(bottom.x * width), int(bottom.y * height)
    
    distance = dis.euclidean(point1, point2)
    return distance

def get_aspect_ratio(image, outputs, top_bottom, left_right):
    aspect_ratios = []
    for face_landmarks in outputs.multi_face_landmarks:
        top = face_landmarks.landmark[top_bottom[0]]
        bottom = face_landmarks.landmark[top_bottom[1]]
        top_bottom_dis = euclidean_distance(image, top, bottom)
        
        left = face_landmarks.landmark[left_right[0]]
        right = face_landmarks.landmark[left_right[1]]
        left_right_dis = euclidean_distance(image, left, right)
        
        aspect_ratio = left_right_dis / top_bottom_dis
        aspect_ratios.append(aspect_ratio)
    return aspect_ratios


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

COLOR_RED = (0, 0, 255)
COLOR_BLUE = (255, 0, 0)
COLOR_GREEN = (0, 255, 0)

LEFT_EYE_TOP_BOTTOM = [386, 374]
LEFT_EYE_LEFT_RIGHT = [263, 362]

RIGHT_EYE_TOP_BOTTOM = [159, 145]
RIGHT_EYE_LEFT_RIGHT = [133, 33]

UPPER_LOWER_LIPS = [13, 14]
LEFT_RIGHT_LIPS = [78, 308]


face_model = mp_face_mesh.FaceMesh(
    static_image_mode=STATIC_IMAGE_MODE,
    max_num_faces=MAX_NUM_FACES,
    min_detection_confidence=DETECTION_CONFIDENCE,
    min_tracking_confidence=TRACKING_CONFIDENCE)

capture = cv.VideoCapture(0)

min_frame = 6
min_tolerance = 5.0
frame_count=[0]*MAX_NUM_FACES
drowsiness_detected=[False]*MAX_NUM_FACES

while True:
    ret, image = capture.read()
    if not ret:
        break
    
    image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
    results = face_model.process(image_rgb)
    img_h, img_w, img_c = image.shape
    face_2d = np.empty((0, 2), dtype=np.float64)
    face_3d = np.empty((0, 3), dtype=np.float64)
    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
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
                    head=[]
                    if y < -10:
                        head.append("Left")
                    elif y > 10:
                        head.append("Right")
                    elif x < -10:
                        head.append("Down")
                    elif x > 15:
                        head.append("Up")
                    else:
                        head.append("Forward")

                    # Display the nose direction
                    nose_3d_projection, jacobian = cv.projectPoints(nose_3d, rot_vec, trans_vec, cam_matrix, dist_matrix)

                    p1 = (int(nose_2d[0]), int(nose_2d[1]))
                    p2 = (int(nose_2d[0] + y * 10) , int(nose_2d[1] - x * 10))
                    
                    cv.line(image, p1, p2, (255, 0, 0), 3) 

                    #cv.putText(image, text, (20, 50), cv.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 2) 

        draw_landmarks(image, results, LEFT_EYE_TOP_BOTTOM, COLOR_RED)
        draw_landmarks(image, results, LEFT_EYE_LEFT_RIGHT, COLOR_RED)
        aspect_ratios_left = get_aspect_ratio(image, results, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)

        draw_landmarks(image, results, RIGHT_EYE_TOP_BOTTOM, COLOR_RED)
        draw_landmarks(image, results, RIGHT_EYE_LEFT_RIGHT, COLOR_RED)
        aspect_ratios_right = get_aspect_ratio(image, results, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)

        draw_landmarks(image, results, LEFT_RIGHT_LIPS, COLOR_BLUE)
        draw_landmarks(image, results, UPPER_LOWER_LIPS, COLOR_BLUE)
        aspect_ratios_lips = get_aspect_ratio(image, results, UPPER_LOWER_LIPS, LEFT_RIGHT_LIPS )


        for idx, (ratio_left, ratio_right,ratio_lips) in enumerate(zip(aspect_ratios_left, aspect_ratios_right,aspect_ratios_lips)):
            ratio=(ratio_left + ratio_right) / 2   
            if ratio > min_tolerance:
                frame_count[idx] +=1
            else:
                frame_count[idx] = 0
       
            if frame_count[idx] > min_frame:
                drowsiness_detected[idx]=True
            else:
                drowsiness_detected[idx]=False

            if ratio_lips < 1.8:
                print(f"Yawn detected in {idx+1}")

    timestamp = time.strftime("%H:%M:%S")
    print(f"{timestamp}")
    drowsy_faces = [idx+1 for idx, detected in enumerate(drowsiness_detected) if detected]
    if drowsy_faces:
        print("Drowsiness detected in face(s):", ", ".join(map(str, drowsy_faces)))


    cv.imshow('Integrated', image)
    if cv.waitKey(5) & 0xFF == 27:
        break
    
capture.release()
cv.destroyAllWindows()