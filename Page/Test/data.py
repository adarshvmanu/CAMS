import json
import random
import time

def generate_data():
    # Generate random data for chart 1
    data = []
    current_time = int(time.time())  # Get current time in seconds
    for i in range(7):
        data_point = {
            "time": current_time + i * 5,  # Increment time by 5 seconds for each data point
            "value": random.randint(0, 100)  # Random value
        }
        data.append(data_point)
    return data

def write_to_json(data):
    # Write data to JSON file
    with open('data.json', 'w') as file:
        json.dump({"chart2": data}, file)

while True:
    # Generate new data and write to JSON file
    data = generate_data()
    write_to_json(data)
    print("Data written to data.json:", data)
    time.sleep(5)
