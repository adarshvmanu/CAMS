import mediapipe as mp
import cv2 as cv
from scipy.spatial import distance as dis
import time

def draw_landmarks(image, outputs, land_mark, color):
    height, width = image.shape[:2]
             
    for face_landmarks in outputs.multi_face_landmarks:
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

mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

STATIC_IMAGE_MODE = False
MAX_NUM_FACES = 2
DETECTION_CONFIDENCE = 0.6
TRACKING_CONFIDENCE = 0.5

COLOR_RED = (0, 0, 255)
COLOR_BLUE = (255, 0, 0)
COLOR_GREEN = (0, 255, 0)

LEFT_EYE_TOP_BOTTOM = [386, 374]
LEFT_EYE_LEFT_RIGHT = [263, 362]

RIGHT_EYE_TOP_BOTTOM = [159, 145]
RIGHT_EYE_LEFT_RIGHT = [133, 33]

LEFT_RIGHT_LIPS = [78, 308]

face_model = mp_face_mesh.FaceMesh(
    static_image_mode=STATIC_IMAGE_MODE,
    max_num_faces=MAX_NUM_FACES,
    min_detection_confidence=DETECTION_CONFIDENCE,
    min_tracking_confidence=TRACKING_CONFIDENCE)

capture = cv.VideoCapture(0)

while True:
    ret, image = capture.read()
    if not ret:
        break
    
    image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
    results = face_model.process(image_rgb)

    if results.multi_face_landmarks:
        draw_landmarks(image, results, LEFT_EYE_TOP_BOTTOM, COLOR_RED)
        draw_landmarks(image, results, LEFT_EYE_LEFT_RIGHT, COLOR_RED)
        aspect_ratios_left = get_aspect_ratio(image, results, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)
        
        draw_landmarks(image, results, RIGHT_EYE_TOP_BOTTOM, COLOR_RED)
        draw_landmarks(image, results, RIGHT_EYE_LEFT_RIGHT, COLOR_RED)
        aspect_ratios_right = get_aspect_ratio(image, results, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)
        
        draw_landmarks(image, results, LEFT_RIGHT_LIPS, COLOR_BLUE)
        aspect_ratios_lips = get_aspect_ratio(image, results, LEFT_RIGHT_LIPS, LEFT_RIGHT_LIPS)
        
        for idx, (ratio_left, ratio_right, ratio_lips) in enumerate(zip(aspect_ratios_left, aspect_ratios_right, aspect_ratios_lips)):
            if (ratio_left + ratio_right) / 2 > 5:
                print(f"Drowsiness detected in face {idx+1}")
            if ratio_lips < 1.8:
                print(f"Yawning detected in face {idx+1}")


    cv.imshow('Face Mesh', image)
    if cv.waitKey(5) & 0xFF == 27:
        break

capture.release()
cv.destroyAllWindows()


###

def calculate_attention_score(sleep_detected, yawn_detected, facing_classroom):
    
    sleep_weight = 0.5
    yawn_weight = 0.3
    facing_weight = 0.2
    attention_scores = []
    facing_count=0
    sleep_count=0
    yawn_count=0
    size=len(sleep_detected)

    for i in range(size):
        sleep_score = 10 if sleep_detected[i] else 50
        yawn_score = 10 if yawn_detected[i] else 50
        facing_score = 50 if facing_classroom[i] else 0

        if facing_classroom[i]==True:
            facing_count+=1
        if yawn_detected[i]==True:
            yawn_count+=1
        if sleep_detected==True:
            sleep_count+=1
        
        total_score = (sleep_score * sleep_weight) + (yawn_score * yawn_weight) + (facing_score * facing_weight)
        attention_score = min(max(total_score, 0), 100)
        attention_scores.append(attention_score)
        
    attention_score=mean(attention_scores) 
    overall_score.append(attention_score)  
    sleep=((sleep_count)/size)*100
    yawn=((yawn_count)/size)*100
    head=((facing_count)/size)*100
    pack_json(attention_score,sleep,yawn,head)

def pack_json(attention_score,sleep,yawn,head):
    timestamp = time.now().strftime("%H:%M")
    data = {
        "time": timestamp,
        "attention_scores": attention_score,
        "sleep_detected": sleep,
        "yawn_detected": yawn,
        "facing_classroom": head,
        "overall_score" : mean(overall_score)
    }
    json_data = json.dumps(data)
    with open('data.json', 'w') as file:
        json.dump({"chart": json_data}, file)