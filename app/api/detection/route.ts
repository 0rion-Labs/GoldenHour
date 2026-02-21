import { NextRequest, NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────
interface Detection {
  zone: string;
  confidence: number;
  timestamp: number;
  receivedAt: number; // epoch ms – lets the client tell "new" from "old"
}

// ── In-memory store (persists across requests while the server is running) ──
let latestDetection: Detection | null = null;

// ── POST /api/detection ──────────────────────────────────────────────────
// Body: { "zone": "CENTER", "confidence": 0.87, "timestamp": 12.3 }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zone, confidence, timestamp } = body;

    latestDetection = {
      zone: zone ?? "UNKNOWN",
      confidence: confidence ?? 0,
      timestamp: timestamp ?? 0,
      receivedAt: Date.now(),
    };

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

// ── GET /api/detection ───────────────────────────────────────────────────
// Returns the latest stored detection (or null if none yet)
export async function GET() {
  return NextResponse.json({ detection: latestDetection });
}
