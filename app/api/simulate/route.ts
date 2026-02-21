import { NextResponse } from "next/server";

/**
 * POST /api/simulate
 *
 * Triggers a scripted 4-intersection corridor clearance demo.
 * Sends sequential detection events to /api/detection spaced 3 seconds apart
 * to simulate an ambulance traversing all intersections.
 *
 * Usage: curl -X POST http://localhost:3000/api/simulate
 */

const DEMO_DETECTIONS = [
  { zone: "LEFT",   confidence: 0.92, timestamp: 0.0 },
  { zone: "CENTER", confidence: 0.88, timestamp: 3.0 },
  { zone: "CENTER", confidence: 0.95, timestamp: 8.0 },
  { zone: "RIGHT",  confidence: 0.84, timestamp: 15.0 },
];

let simulating = false;

export async function POST() {
  if (simulating) {
    return NextResponse.json({ success: false, error: "Simulation already running" }, { status: 409 });
  }

  simulating = true;

  // Fire detections sequentially in the background
  (async () => {
    for (let i = 0; i < DEMO_DETECTIONS.length; i++) {
      const det = DEMO_DETECTIONS[i];
      try {
        await fetch("http://localhost:3000/api/detection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zone: det.zone,
            confidence: det.confidence,
            timestamp: det.timestamp,
            trackId: 99,
            direction: "EAST",
            velocity: { dx: 12.5, dy: -1.2 },
          }),
        });
      } catch {
        /* ignore */
      }

      // Wait 3 seconds before next detection (except after the last one)
      if (i < DEMO_DETECTIONS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    simulating = false;
  })();

  return NextResponse.json({
    success: true,
    message: "Simulation started — 4 detections will fire over the next 12 seconds",
  });
}

export async function GET() {
  return NextResponse.json({ simulating });
}
