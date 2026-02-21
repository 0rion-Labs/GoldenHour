import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/beacon
 *
 * GPS Beacon endpoint — fallback mode when camera feed is lost.
 * Ambulance PWA sends periodic location updates here.
 *
 * Body: { lat, lng, speed, heading, timestamp }
 *
 * When received, this triggers a detection event in GPS fallback mode.
 */

interface BeaconPayload {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: number;
}

let latestBeacon: (BeaconPayload & { receivedAt: number }) | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng, speed, heading, timestamp } = body;

    latestBeacon = {
      lat: lat ?? 0,
      lng: lng ?? 0,
      speed: speed ?? 0,
      heading: heading ?? 0,
      timestamp: timestamp ?? 0,
      receivedAt: Date.now(),
    };

    // Forward as a detection event in fallback mode
    // Determine zone from longitude offset (simplified)
    let zone = "CENTER";
    if (lng < 77.595) zone = "LEFT";
    else if (lng > 77.605) zone = "RIGHT";

    try {
      await fetch("http://localhost:3000/api/detection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone,
          confidence: 0.75, // Lower confidence for GPS-only mode
          timestamp,
          trackId: 0,
          direction: headingToDirection(heading),
          velocity: { dx: speed * Math.cos((heading * Math.PI) / 180), dy: speed * Math.sin((heading * Math.PI) / 180) },
        }),
      });
    } catch {
      /* self-POST failed — ignore */
    }

    return NextResponse.json({ success: true, mode: "gps_fallback" });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid beacon payload" },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ beacon: latestBeacon });
}

function headingToDirection(heading: number): string {
  if (heading >= 315 || heading < 45) return "NORTH";
  if (heading >= 45 && heading < 135) return "EAST";
  if (heading >= 135 && heading < 225) return "SOUTH";
  return "WEST";
}
