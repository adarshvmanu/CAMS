import mediapipe as mp
import cv2 as cv
from scipy.spatial import distance as dis
    

def draw_landmarks(image, outputs, land_mark, color):
    height, width =image.shape[:2]
             
    for face in land_mark:
        point = outputs.multi_face_landmarks[0].landmark[face]
        
        point_scale = ((int)(point.x * width), (int)(point.y*height))
        
        cv.circle(image, point_scale, 2, color, 1)
        
def euclidean_distance(image, top, bottom):
    height, width = image.shape[0:2]
            
    point1 = int(top.x * width), int(top.y * height)
    point2 = int(bottom.x * width), int(bottom.y * height)
    
    distance = dis.euclidean(point1, point2)
    return distance


def get_aspect_ratio(image, outputs, top_bottom, left_right):
    landmark = outputs.multi_face_landmarks[0]
       
    top = landmark.landmark[top_bottom[0]]
    bottom = landmark.landmark[top_bottom[1]]
    
    top_bottom_dis = euclidean_distance(image, top, bottom)
    
    left = landmark.landmark[left_right[0]]
    right = landmark.landmark[left_right[1]]
    
    left_right_dis = euclidean_distance(image, left, right)
    
    aspect_ratio = left_right_dis/ top_bottom_dis
    
    return aspect_ratio
      
face_mesh = mp.solutions.face_mesh
draw_utils = mp.solutions.drawing_utils
landmark_style = draw_utils.DrawingSpec((0,255,0), thickness=1, circle_radius=1)
connection_style = draw_utils.DrawingSpec((0,0,255), thickness=1, circle_radius=1)


STATIC_IMAGE = False
MAX_NO_FACES = 4
DETECTION_CONFIDENCE = 0.6
TRACKING_CONFIDENCE = 0.5

COLOR_RED = (0,0,255)
COLOR_BLUE = (255,0,0)
COLOR_GREEN = (0,255,0)

RIGHT_EYE = [ 33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161 , 246 ]
LEFT_EYE = [ 362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385,384, 398 ]


LEFT_EYE_TOP_BOTTOM = [386, 374]
LEFT_EYE_LEFT_RIGHT = [263, 362]

RIGHT_EYE_TOP_BOTTOM = [159, 145]
RIGHT_EYE_LEFT_RIGHT = [133, 33]


FACE=[ 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
       377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103,67, 109]

face_model = face_mesh.FaceMesh(static_image_mode=STATIC_IMAGE,
                                max_num_faces= MAX_NO_FACES,
                                min_detection_confidence=DETECTION_CONFIDENCE,
                                min_tracking_confidence=TRACKING_CONFIDENCE)


capture = cv.VideoCapture(0)

frame_count = 0
min_frame = 6
min_tolerance = 5.0


while True:
    result, image = capture.read()
    
    if result:
        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        outputs = face_model.process(image_rgb)

        if outputs.multi_face_landmarks:
           
            draw_landmarks(image, outputs, FACE, COLOR_GREEN)
                  
            draw_landmarks(image, outputs, LEFT_EYE_TOP_BOTTOM, COLOR_RED)
            draw_landmarks(image, outputs, LEFT_EYE_LEFT_RIGHT, COLOR_RED)
            
            ratio_left =  get_aspect_ratio(image, outputs, LEFT_EYE_TOP_BOTTOM, LEFT_EYE_LEFT_RIGHT)
            
            draw_landmarks(image, outputs, RIGHT_EYE_TOP_BOTTOM, COLOR_RED)
            draw_landmarks(image, outputs, RIGHT_EYE_LEFT_RIGHT, COLOR_RED)
            
            ratio_right =  get_aspect_ratio(image, outputs, RIGHT_EYE_TOP_BOTTOM, RIGHT_EYE_LEFT_RIGHT)
            
            ratio = (ratio_left + ratio_right)/2.0
            
            if ratio > min_tolerance:
                frame_count +=1
            else:
                frame_count = 0
                
            if frame_count > min_frame:
                message = 'Sleep Detected'
                print(message)
           
            
           
        cv.imshow("FACE MESH", image)
        if cv.waitKey(1) & 255 == 27:
            break
               
capture.release()
cv.destroyAllWindows()