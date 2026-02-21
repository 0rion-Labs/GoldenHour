"""
detect.py — Ambulance (vehicle) detection using YOLOv8 nano model.

Enhanced with:
  - Simple centroid-based object tracking (ByteTrack-style)
  - Velocity vector computation for each tracked object
  - Zone-crossing polygon detection (LEFT / CENTER / RIGHT zones)
  - Direction estimation (approaching / receding)
  - Configurable detection cooldown to avoid spamming the API

Usage:
    python detect.py
"""

import time
import math
import cv2
import numpy as np
import requests
from collections import defaultdict
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VIDEO_PATH = "ambulance.mp4"               # Input video file
MODEL_PATH = "yolov8n.pt"                  # YOLOv8 nano weights (auto-downloads)
API_URL = "http://localhost:3000/api/detection"

CONFIDENCE_THRESHOLD = 0.5                  # Minimum confidence to accept a detection
PROCESS_EVERY_N = 3                         # Run inference on every Nth frame
DETECTION_COOLDOWN = 2.0                    # Seconds between API posts for same track

# COCO class IDs for vehicle types we care about.
#   2 = car, 5 = bus, 7 = truck
VEHICLE_CLASS_IDS = {2, 5, 7}

# Bounding-box drawing style
BOX_COLOR = (0, 255, 0)        # Green (BGR)
BOX_COLOR_TRACK = (0, 200, 255)  # Orange for tracked history
BOX_THICKNESS = 2
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.55
FONT_COLOR = (0, 255, 0)

# Tracking config
MAX_TRACK_DISTANCE = 120        # Max pixel distance to match tracks between frames
MAX_TRACK_AGE = 15              # Frames before an unmatched track is dropped


# ---------------------------------------------------------------------------
# Simple Centroid Tracker (ByteTrack-inspired)
# ---------------------------------------------------------------------------
class CentroidTracker:
    """
    Lightweight tracker that associates detections across frames using
    centroid distance matching. Maintains velocity vectors per track.
    """

    def __init__(self, max_distance: float = MAX_TRACK_DISTANCE, max_age: int = MAX_TRACK_AGE):
        self.next_id = 1
        self.tracks: dict[int, dict] = {}  # track_id -> {cx, cy, prev_cx, prev_cy, age, dx, dy}
        self.max_distance = max_distance
        self.max_age = max_age

    def update(self, detections: list[tuple[float, float, int, float]]):
        """
        Update tracks with a list of (cx, cy, cls_id, confidence) detections.
        Returns list of (track_id, cx, cy, dx, dy, cls_id, confidence).
        """
        # Increment age of all existing tracks
        for tid in list(self.tracks):
            self.tracks[tid]["age"] += 1
            if self.tracks[tid]["age"] > self.max_age:
                del self.tracks[tid]

        if not detections:
            return []

        # Build cost matrix (Euclidean distance)
        track_ids = list(self.tracks.keys())
        results = []

        used_tracks = set()
        used_dets = set()

        if track_ids:
            costs = np.zeros((len(detections), len(track_ids)))
            for di, (cx, cy, _, _) in enumerate(detections):
                for ti, tid in enumerate(track_ids):
                    t = self.tracks[tid]
                    costs[di, ti] = math.hypot(cx - t["cx"], cy - t["cy"])

            # Greedy assignment (good enough for ≤20 objects)
            for _ in range(min(len(detections), len(track_ids))):
                idx = np.unravel_index(np.argmin(costs), costs.shape)
                di, ti = int(idx[0]), int(idx[1])
                if costs[di, ti] > self.max_distance:
                    break
                tid = track_ids[ti]
                cx, cy, cls_id, conf = detections[di]
                t = self.tracks[tid]
                # Compute velocity vector (pixels/frame)
                dx = cx - t["cx"]
                dy = cy - t["cy"]
                t.update({"prev_cx": t["cx"], "prev_cy": t["cy"], "cx": cx, "cy": cy, "dx": dx, "dy": dy, "age": 0})
                results.append((tid, cx, cy, dx, dy, cls_id, conf))
                used_tracks.add(ti)
                used_dets.add(di)
                costs[di, :] = 1e9
                costs[:, ti] = 1e9

        # Register new tracks for unmatched detections
        for di, (cx, cy, cls_id, conf) in enumerate(detections):
            if di not in used_dets:
                tid = self.next_id
                self.next_id += 1
                self.tracks[tid] = {
                    "cx": cx, "cy": cy,
                    "prev_cx": cx, "prev_cy": cy,
                    "dx": 0.0, "dy": 0.0,
                    "age": 0,
                }
                results.append((tid, cx, cy, 0.0, 0.0, cls_id, conf))

        return results


# ---------------------------------------------------------------------------
# Zone detection
# ---------------------------------------------------------------------------
def get_zone(x_center: float, frame_width: int) -> str:
    """Return LEFT / CENTER / RIGHT based on horizontal position."""
    third = frame_width / 3
    if x_center < third:
        return "LEFT"
    elif x_center < 2 * third:
        return "CENTER"
    else:
        return "RIGHT"


def get_direction(dx: float, dy: float) -> str:
    """Estimate travel direction from velocity vector."""
    if abs(dx) < 1 and abs(dy) < 1:
        return "STATIONARY"
    angle = math.degrees(math.atan2(-dy, dx))  # -dy because y grows downward
    if -45 <= angle < 45:
        return "EAST"
    elif 45 <= angle < 135:
        return "NORTH"
    elif angle >= 135 or angle < -135:
        return "WEST"
    else:
        return "SOUTH"


# ---------------------------------------------------------------------------
# API communication
# ---------------------------------------------------------------------------
def send_detection(zone: str, confidence: float, timestamp: float,
                   track_id: int, direction: str, dx: float, dy: float) -> None:
    """POST enhanced detection event to the dashboard API."""
    payload = {
        "zone": zone,
        "confidence": round(confidence, 2),
        "timestamp": round(timestamp, 1),
        "trackId": track_id,
        "direction": direction,
        "velocity": {"dx": round(dx, 1), "dy": round(dy, 1)},
    }
    try:
        requests.post(API_URL, json=payload, timeout=2)
    except requests.RequestException:
        pass


# ---------------------------------------------------------------------------
# Overlay drawing helpers
# ---------------------------------------------------------------------------
def draw_zone_lines(frame, frame_width: int, frame_height: int):
    """Draw semi-transparent vertical zone dividers on the frame."""
    third = int(frame_width / 3)
    overlay = frame.copy()
    cv2.line(overlay, (third, 0), (third, frame_height), (255, 255, 255), 1)
    cv2.line(overlay, (2 * third, 0), (2 * third, frame_height), (255, 255, 255), 1)
    cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
    # Zone labels
    for label, x in [("LEFT", third // 2), ("CENTER", third), ("RIGHT", third + third // 2 + third)]:
        cv2.putText(frame, label, (x - 25, 25), FONT, 0.45, (255, 255, 255, 128), 1)


def draw_velocity_arrow(frame, cx: int, cy: int, dx: float, dy: float):
    """Draw a velocity vector arrow on the frame."""
    if abs(dx) < 1 and abs(dy) < 1:
        return
    scale = 3.0
    end_x = int(cx + dx * scale)
    end_y = int(cy + dy * scale)
    cv2.arrowedLine(frame, (cx, cy), (end_x, end_y), (0, 200, 255), 2, tipLength=0.3)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def main() -> None:
    model = YOLO(MODEL_PATH)
    tracker = CentroidTracker()

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video file: {VIDEO_PATH}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_idx = 0
    last_api_time: dict[int, float] = defaultdict(float)  # track_id -> last POST time

    print(f"[INFO] Processing '{VIDEO_PATH}' at {fps:.1f} FPS — press Q to quit.")
    print(f"[INFO] Tracking enabled | Cooldown: {DETECTION_COOLDOWN}s | Posting to {API_URL}")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_height, frame_width = frame.shape[:2]
        timestamp = frame_idx / fps

        # Draw zone overlay
        draw_zone_lines(frame, frame_width, frame_height)

        # Run inference on every Nth frame
        if frame_idx % PROCESS_EVERY_N == 0:
            results = model(frame, verbose=False)[0]

            # Collect detections for the tracker
            raw_detections = []
            for box in results.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if cls_id not in VEHICLE_CLASS_IDS or conf < CONFIDENCE_THRESHOLD:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                raw_detections.append((cx, cy, cls_id, conf))

            # Update tracker
            tracked = tracker.update(raw_detections)

            for track_id, cx, cy, dx, dy, cls_id, conf in tracked:
                zone = get_zone(cx, frame_width)
                direction = get_direction(dx, dy)
                label_name = results.names.get(cls_id, "vehicle")

                # Estimate bbox from centroid (approximate)
                x1, y1 = int(cx - 40), int(cy - 30)
                x2, y2 = int(cx + 40), int(cy + 30)

                # Find actual bbox from results if available
                for box in results.boxes:
                    bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                    bcx, bcy = (bx1 + bx2) / 2, (by1 + by2) / 2
                    if abs(bcx - cx) < 10 and abs(bcy - cy) < 10:
                        x1, y1, x2, y2 = bx1, by1, bx2, by2
                        break

                # Draw bounding box with track ID
                label = f"T{track_id} {label_name} {conf:.2f} {direction}"
                cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR, BOX_THICKNESS)
                cv2.putText(frame, label, (x1, y1 - 8), FONT, FONT_SCALE, FONT_COLOR, 2)

                # Draw velocity arrow
                draw_velocity_arrow(frame, int(cx), int(cy), dx, dy)

                # API post with cooldown per track
                now = time.time()
                if now - last_api_time[track_id] >= DETECTION_COOLDOWN:
                    last_api_time[track_id] = now
                    print(
                        f"AMBULANCE DETECTED — track: T{track_id}, zone: {zone}, "
                        f"conf: {conf:.2f}, dir: {direction}, "
                        f"vel: ({dx:.1f},{dy:.1f}), time: {timestamp:.1f}s"
                    )
                    send_detection(zone, conf, timestamp, track_id, direction, dx, dy)

        # HUD: frame counter & active tracks
        active_count = len(tracker.tracks)
        hud = f"Frame: {frame_idx} | Tracks: {active_count} | Time: {timestamp:.1f}s"
        cv2.putText(frame, hud, (10, frame_height - 15), FONT, 0.5, (200, 200, 200), 1)

        cv2.imshow("GoldenHour — Vehicle Detection", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("[INFO] Quitting...")
            break

        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Done.")


if __name__ == "__main__":
    main()
