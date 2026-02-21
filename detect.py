"""
detect.py — Ambulance (vehicle) detection using YOLOv8 nano model.

Processes a video file frame-by-frame, runs YOLOv8 inference on every 3rd frame,
draws bounding boxes around detected vehicles, and sends detection events to a
local API endpoint via HTTP POST.

Usage:
    python detect.py
"""

import cv2
import requests
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VIDEO_PATH = "ambulance.mp4"               # Input video file
MODEL_PATH = "yolov8n.pt"                  # YOLOv8 nano weights (auto-downloads)
API_URL = "http://localhost:3000/api/detection"

CONFIDENCE_THRESHOLD = 0.5                  # Minimum confidence to accept a detection
PROCESS_EVERY_N = 3                         # Run inference on every Nth frame

# COCO class IDs for vehicle types we care about.
# (YOLOv8 uses the COCO 80-class mapping)
#   2 = car, 5 = bus, 7 = truck
VEHICLE_CLASS_IDS = {2, 5, 7}

# Bounding-box drawing style
BOX_COLOR = (0, 255, 0)    # Green (BGR)
BOX_THICKNESS = 2
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.6
FONT_COLOR = (0, 255, 0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_zone(x_center: float, frame_width: int) -> str:
    """Return LEFT / CENTER / RIGHT based on where the detection sits."""
    third = frame_width / 3
    if x_center < third:
        return "LEFT"
    elif x_center < 2 * third:
        return "CENTER"
    else:
        return "RIGHT"


def send_detection(zone: str, confidence: float, timestamp: float) -> None:
    """POST a detection event to the local API (fire-and-forget)."""
    payload = {
        "zone": zone,
        "confidence": round(confidence, 2),
        "timestamp": round(timestamp, 1),
    }
    try:
        requests.post(API_URL, json=payload, timeout=2)
    except requests.RequestException:
        # Server may not be running — silently ignore so the detector keeps going.
        pass


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    # Load YOLOv8 nano model (downloads weights automatically on first run)
    model = YOLO(MODEL_PATH)

    # Open the video file
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video file: {VIDEO_PATH}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0  # Fallback to 30 FPS
    frame_idx = 0

    print(f"[INFO] Processing '{VIDEO_PATH}' at {fps:.1f} FPS — press Q to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break  # End of video

        frame_width = frame.shape[1]
        timestamp = frame_idx / fps  # Current time in seconds

        # Only run inference on every Nth frame for speed
        if frame_idx % PROCESS_EVERY_N == 0:
            # Run YOLOv8 inference (verbose=False suppresses per-frame logs)
            results = model(frame, verbose=False)[0]

            for box in results.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])

                # Filter: must be a vehicle class with sufficient confidence
                if cls_id not in VEHICLE_CLASS_IDS or conf < CONFIDENCE_THRESHOLD:
                    continue

                # Extract bounding-box coordinates (xyxy format)
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x_center = (x1 + x2) / 2
                zone = get_zone(x_center, frame_width)

                # Get human-readable class name from the model
                label = f"{results.names[cls_id]} {conf:.2f}"

                # Draw bounding box and label on the frame
                cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR, BOX_THICKNESS)
                cv2.putText(
                    frame, label, (x1, y1 - 8),
                    FONT, FONT_SCALE, FONT_COLOR, 2,
                )

                # Console log
                print(
                    f"AMBULANCE DETECTED — zone: {zone}, "
                    f"confidence: {conf:.2f}, timestamp: {timestamp:.1f}s"
                )

                # Notify the web app
                send_detection(zone, conf, timestamp)

        # Show the annotated frame in a window
        cv2.imshow("GoldenHour — Vehicle Detection", frame)

        # Press 'Q' to exit early
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("[INFO] Quitting...")
            break

        frame_idx += 1

    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Done.")


if __name__ == "__main__":
    main()
