"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Simulated 24-hour corridor activation data ────────────────────────
// In production this would come from MongoDB aggregation
function generateHourlyData() {
  const now = new Date();
  const data = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600_000);
    const label = hour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    // Simulate realistic traffic: higher during rush hours (8-10, 17-19)
    const h = hour.getHours();
    const base =
      (h >= 8 && h <= 10) || (h >= 17 && h <= 19)
        ? 12 + Math.floor(Math.random() * 8)
        : 2 + Math.floor(Math.random() * 5);
    data.push({ time: label, activations: base });
  }
  return data;
}

interface Props {
  /** Extra live activations to add to the current hour */
  liveBump?: number;
}

export default function CorridorLineChart({ liveBump = 0 }: Props) {
  const data = generateHourlyData();
  // Bump the most recent hour with live detection count
  if (data.length > 0) {
    data[data.length - 1].activations += liveBump;
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="time"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            interval={3}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            stroke="rgba(255,255,255,0.1)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0d2b4e",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="activations"
            stroke="#00e676"
            strokeWidth={2}
            dot={{ r: 2, fill: "#00e676" }}
            activeDot={{ r: 5, fill: "#00e676" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
