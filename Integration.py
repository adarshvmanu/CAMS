import mediapipe as mp
import cv2 as cv
from scipy.spatial import distance as dis
import time
import numpy as np
import json
from statistics import mean

overall_score=[]

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

        if len(top_bottom) == 4:
            top = face_landmarks.landmark[top_bottom[2]]
            bottom = face_landmarks.landmark[top_bottom[3]]
            top_bottom_dis_2 = euclidean_distance(image, top, bottom)
            aspect_ratio = (top_bottom_dis+top_bottom_dis_2)/(2*left_right_dis)

        aspect_ratios.append(aspect_ratio)
    return aspect_ratios

def calculate_attention_score(sleep_detected, yawn_detected, facing_classroom,size):
    sleep_weight = 0.5
    yawn_weight = 0.3
    facing_weight = 0.2
    attention_scores = []
    facing_count=0
    sleep_count=0
    yawn_count=0

    for i in range(size):
        sleep_score = 0 if sleep_detected[i] else 100
        yawn_score = 0 if yawn_detected[i] else 100
        facing_score = 100 if facing_classroom[i] else 0

        if facing_classroom[i]==True:
            facing_count+=1
        if yawn_detected[i]==True:
            yawn_count+=1
        if sleep_detected[i]==True:
            sleep_count+=1
            sleep_weight = 0.7
            yawn_weight = 0.2
            facing_weight = 0.1
        
        total_score = (sleep_score * sleep_weight) + (yawn_score * yawn_weight) + (facing_score * facing_weight)
        attention_scores.append(total_score)
        
    attention_score=mean(attention_scores) 
    overall_score.append(attention_score)  
    sleep=((sleep_count)/size)*100
    yawn=((yawn_count)/size)*100
    head=((facing_count)/size)*100
    pack_json(attention_score,sleep,yawn,head,size)
 
def pack_json(attention_score, sleep, yawn, head,size):
    current_time = time.localtime()
    timestamp = time.strftime("%H-%M-%S", current_time)
    
    data = {
        "timestamp" : timestamp,
        "attention_scores": attention_score,
        "sleep_detected": sleep,
        "yawn_detected": yawn,
        "facing_classroom": head,
        "overall_score": round(mean(overall_score),2),
        "count": size
    }
    
    json_data = json.dumps({"chart":data})  # Enclosing data within timestamp key
    
    try:
        with open('Page/data.json', 'w') as file:  # Open file in write mode ('w')
            file.write(json_data)  # Write JSON data to the file
    except IOError as e:
        print("Error writing to data.json:", e)
    
face_mesh = mp.solutions.face_mesh
draw_utils = mp.solutions.drawing_utils
landmark_style = draw_utils.DrawingSpec((0,255,0), thickness=1, circle_radius=1)
connection_style = draw_utils.DrawingSpec((0,0,255), thickness=1, circle_radius=1)


mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

STATIC_IMAGE_MODE = False
MAX_NUM_FACES = 4
DETECTION_CONFIDENCE = 0.6
TRACKING_CONFIDENCE = 0.6

COLOR_RED = (0, 0, 255)
COLOR_BLUE = (255, 0, 0)
COLOR_GREEN = (0, 255, 0)

LEFT_EYE_TOP_BOTTOM = [386, 374, 385, 380]
LEFT_EYE_LEFT_RIGHT = [263, 362]

RIGHT_EYE_TOP_BOTTOM = [160, 144, 158, 153]
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
min_tolerance = 0.22
frame_count=[0]*MAX_NUM_FACES
sleep_detected=[False]*MAX_NUM_FACES
yawn_detected=[False]*MAX_NUM_FACES
facing_classroom=[False]*MAX_NUM_FACES
overall_score=[]


while True:
    success, image = capture.read()
    if not success:
        break
    
    image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
    results = face_model.process(image_rgb)
    img_h, img_w, img_c = image.shape
    head=[]
    face_count=0
    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            face_count+=1
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
            if ratio < min_tolerance:
                frame_count[idx] +=1
            else:
                frame_count[idx] = 0
       
            if frame_count[idx] > min_frame:
                sleep_detected[idx]=True
            else:
                sleep_detected[idx]=False

            if ratio_lips < 1.8:
                yawn_detected[idx]=True
            else:
                yawn_detected[idx]=False

    for idx, t in enumerate(head):
        if head[idx]=="Forward":
            facing_classroom[idx]=True
        else:
            facing_classroom[idx]=False

    if face_count != 0:
        calculate_attention_score(sleep_detected,yawn_detected,facing_classroom,face_count)
        print(f"Sleep: {sleep_detected} Yawn : {yawn_detected} Facing : {facing_classroom}\n")
    face_count=0


    cv.imshow('Integrated', image)
    if cv.waitKey(5) & 0xFF == 27:
        break
    
capture.release()
cv.destroyAllWindows()