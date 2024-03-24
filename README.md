# Classroom Attention Monitoring System

This project aims to track the attentiveness of the students in a classroom. The project contains 3 modules which are split and integrated to achieve the final system. We will be using modules such as :

1. Eye Closure and Opening Detection
2. Yawn Detection 
3. HeadPose Detection 

We are using Mediapipe for this project which is an open-source framework by Google, which helps to perform tasks which fall into the array of Computer Vision etc. Mediapipe also reduces the dependence of GPU so that it becomes easy to work.

Let's see how each module is build 

1.**EAR (Eye Aspect Ratio)**

The Functionalities of the Module :
 1. Tracks the movement of both the eyelids to sense the movement.
 2. Involves the calculation of the Eye Aspect Ratio.
 3. Calculates both the frequency and duration of the eyes blinking.
 4. Finally detects drowsiness and prolonged closure. 

**Implementation**

This Python script detects drowsiness in faces captured through a webcam using facial landmarks extracted with the MediaPipe FaceMesh model, OpenCV for video processing, and SciPy for calculating distances.

1. Import necessary libraries including media pipe, cv2 (OpenCV), and scipy.
2. Define functions:
    1. `draw_landmarks`: Draws landmarks on the face detected by MediaPipe.
    2. `euclidean_distance`: Calculates the Euclidean distance between two points.
    3. `get_aspect_ratio`: Calculates the aspect ratio of specific facial landmarks.
3. Set up configurations for the MediaPipe FaceMesh model.
4. Define configurations and constants such as colors and facial landmark indices.
5. Initialize the MediaPipe FaceMesh model and a video capture object.
6. Enter a loop where it continuously captures frames from the webcam.
7. Process each frame through the FaceMesh model to detect faces and facial landmarks.
8. Calculate the aspect ratio for both eyes and determine if drowsiness is detected based on certain thresholds.
9. Print timestamps and alerts if drowsiness is detected in any of the faces.
10. Display the processed frame with landmarks drawn using OpenCV.
11. Exit the loop if the 'Esc' key is pressed.


2. **Yawn Detection**

**Functionalities of the module**

1. Calculates the Mouth Aspect Ratio to determine the degree of mouth openess.
2. Tracks the frequency of yawning.
3. Measure the duration of yawning events.

**Implementation** 

This Python script uses MediaPipe FaceMesh to detect facial landmarks and identifies yawning based on the aspect ratio of the mouth. Here's a breakdown of the code:

1. Import necessary libraries: `mediapipe` for face mesh detection, `cv2` for OpenCV operations, and `scipy.spatial.distance` for calculating distances.
2. Define functions:
   1. `draw_landmarks`: Draws specified landmarks on the face detected by MediaPipe FaceMesh.
   2. `euclidean_distance`: Calculates the Euclidean distance between two points.
   3. `get_aspect_ratio`: Calculates the aspect ratio of mouth landmarks.
3. Set configurations and constants for the MediaPipe FaceMesh model, such as confidence thresholds, colors, and facial landmark indices for the mouth.
4. Initialize the FaceMesh model and the video capture object.
5. Enter a loop to continuously capture frames from the webcam.
6. Process each frame through the FaceMesh model to detect facial landmarks.
7. Calculate the aspect ratio of the mouth based on specified mouth landmarks.
8. Check if the aspect ratio is below a certain tolerance for yawning detection.
9. If yawning is detected (aspect ratio below the tolerance for a certain number of consecutive frames), print a message indicating the detection.
10. Display the annotated frame with landmarks and yawning detection using OpenCV (`cv2.imshow()`).
11. Exit the loop if the 'Esc' key is pressed (`cv2.waitKey()`).

3. **HeadPose Detection**

Functionalities of this Module:
 1. Tracks the head position in real time.
 2. Find the head orientation by calculating pitch, yaw and roll angles.

**Implementation** 

This Python script performs real-time head pose estimation using facial landmarks detected by the MediaPipe FaceMesh model.

1. Import necessary libraries, including cv2 (OpenCV), mediapipe, and numpy.
2. Set up MediaPipe FaceMesh model for facial landmark detection.
3. Initialize the webcam capture using OpenCV (`cv2.VideoCapture`).
4. Enter a loop to continuously capture frames from the webcam (`cap.isOpened()`).
5. Read a frame from the webcam capture (`cap.read()`).
6. Convert the color space of the frame from BGR to RGB and flips it horizontally for later selfie-view display.
7. Process the frame through the FaceMesh model to detect facial landmarks.
8. Convert the color space of the frame back to BGR.
9. Iterate through the detected facial landmarks and extracts specific points of interest, such as nose, eyes, etc.
10. Calculate the 3D coordinates of the detected facial landmarks.
11. Estimate the head pose (yaw, pitch, roll) using the solved PnP (Perspective-n-Point) algorithm.
12. Determine the direction of the user's gaze based on the head pose angles.
13. Draw a line representing the direction of the gaze on the frame.
14. Display the direction of gaze and head pose angles (x, y, z) on the frame.
15. Calculate and display the frames per second (FPS) of the video stream.
16. Display the annotated frame with landmarks and gaze direction using OpenCV (`cv2.imshow()`).
17. Exit the loop if the 'Esc' key is pressed (`cv2.waitKey()`).


This module will be integrated to produce the whole system which will produce real-time results. This will give you information on whether a class is attentive or not based on the average of each module's probability scores.


