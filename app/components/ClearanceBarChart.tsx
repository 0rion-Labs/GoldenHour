"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Simulated per-intersection clearance times ─────────────────────────
const INTERSECTION_DATA = [
  { name: "INT-1", avgClearance: 2.8, color: "#00e676" },
  { name: "INT-2", avgClearance: 4.1, color: "#42a5f5" },
  { name: "INT-3", avgClearance: 5.6, color: "#ffa726" },
  { name: "INT-4", avgClearance: 3.3, color: "#ef5350" },
];

export default function ClearanceBarChart() {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart
          data={INTERSECTION_DATA}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            stroke="rgba(255,255,255,0.1)"
            label={{
              value: "seconds",
              angle: -90,
              position: "insideLeft",
              fill: "rgba(255,255,255,0.35)",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0d2b4e",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
            formatter={(value: unknown) => [`${value}s`, "Avg Clearance"]}
          />
          <Bar dataKey="avgClearance" radius={[4, 4, 0, 0]}>
            {INTERSECTION_DATA.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
