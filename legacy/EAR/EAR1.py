import mediapipe as mp
import cv2 as cv
from scipy.spatial import distance as dis
import time

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
        top_bottom_dis_1 = euclidean_distance(image, top, bottom)
        
        top = face_landmarks.landmark[top_bottom[2]]
        bottom = face_landmarks.landmark[top_bottom[3]]
        top_bottom_dis_2 = euclidean_distance(image, top, bottom)
    
        left = face_landmarks.landmark[left_right[0]]
        right = face_landmarks.landmark[left_right[1]]
        left_right_dis = euclidean_distance(image, left, right)
        
        aspect_ratio = (top_bottom_dis_1+top_bottom_dis_2)/(2*left_right_dis)
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
#[385,380][386,374]
LEFT_EYE_TOP_BOTTOM = [386, 374, 385, 380]
LEFT_EYE_LEFT_RIGHT = [263, 362]
#[160,144][159,145][158,153]
RIGHT_EYE_TOP_BOTTOM = [160, 144, 158, 153]
RIGHT_EYE_LEFT_RIGHT = [133, 33]


face_model = mp_face_mesh.FaceMesh(
    static_image_mode=STATIC_IMAGE_MODE,
    max_num_faces=MAX_NUM_FACES,
    min_detection_confidence=DETECTION_CONFIDENCE,
    min_tracking_confidence=TRACKING_CONFIDENCE)

capture = cv.VideoCapture(0)


min_frame = 6
min_tolerance = 0.22
frame_count=[0]*MAX_NUM_FACES
drowsiness_detected=[False]*MAX_NUM_FACES

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


        for idx, (ratio_left, ratio_right) in enumerate(zip(aspect_ratios_left, aspect_ratios_right)):
            ratio=(ratio_left + ratio_right) / 2   
            if ratio < min_tolerance:
                frame_count[idx] +=1
            else:
                frame_count[idx] = 0       
            if frame_count[idx] > min_frame:
                drowsiness_detected[idx]=True
            else:
                drowsiness_detected[idx]=False
    timestamp = time.strftime("%H:%M:%S")
    print(f"{timestamp}")
    drowsy_faces = [idx+1 for idx, detected in enumerate(drowsiness_detected) if detected]
    if drowsy_faces:
        print("Drowsiness detected in face(s):", ", ".join(map(str, drowsy_faces)))
    cv.imshow('EAR', image)
    if cv.waitKey(5) & 0xFF == 27:
        break
    

capture.release()
cv.destroyAllWindows()