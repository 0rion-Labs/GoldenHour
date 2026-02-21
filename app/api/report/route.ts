import { NextResponse } from "next/server";

/**
 * GET /api/report
 *
 * Returns a PDF-ready JSON analytics report with simulated 30-day stats.
 * In production this would query MongoDB; for demo we generate realistic numbers.
 */
export async function GET() {
  const now = new Date();

  // Generate 30-day daily stats
  const dailyStats = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400_000);
    const corridors = Math.floor(Math.random() * 40 + 120); // 120-160/day
    const avgTimeSaved = Math.round((Math.random() * 10 + 20) * 10) / 10; // 20-30s
    const alerts = Math.floor(corridors * (Math.random() * 0.3 + 0.8)); // 80-110% of corridors

    dailyStats.push({
      date: date.toISOString().split("T")[0],
      corridorsCleared: corridors,
      avgTimeSaved,
      alertsSent: alerts,
      estimatedLivesImpacted: Math.round(corridors * 0.05 * 10) / 10,
    });
  }

  // Aggregated totals
  const totals = dailyStats.reduce(
    (acc, day) => ({
      corridorsCleared: acc.corridorsCleared + day.corridorsCleared,
      avgTimeSaved: acc.avgTimeSaved + day.avgTimeSaved,
      alertsSent: acc.alertsSent + day.alertsSent,
      estimatedLivesImpacted: acc.estimatedLivesImpacted + day.estimatedLivesImpacted,
    }),
    { corridorsCleared: 0, avgTimeSaved: 0, alertsSent: 0, estimatedLivesImpacted: 0 }
  );

  totals.avgTimeSaved = Math.round((totals.avgTimeSaved / 30) * 10) / 10;
  totals.estimatedLivesImpacted = Math.round(totals.estimatedLivesImpacted * 10) / 10;

  return NextResponse.json({
    report: {
      generatedAt: now.toISOString(),
      period: "30 days",
      systemName: "GoldenHour AI Green Corridor",
      totals,
      dailyStats,
      intersections: [
        { id: "INT-1", avgClearanceTime: 2.8, totalActivations: Math.floor(totals.corridorsCleared * 0.35) },
        { id: "INT-2", avgClearanceTime: 4.1, totalActivations: Math.floor(totals.corridorsCleared * 0.28) },
        { id: "INT-3", avgClearanceTime: 5.6, totalActivations: Math.floor(totals.corridorsCleared * 0.22) },
        { id: "INT-4", avgClearanceTime: 3.3, totalActivations: Math.floor(totals.corridorsCleared * 0.15) },
      ],
    },
  });
}
