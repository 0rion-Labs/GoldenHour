"use client";

import { useState, useEffect } from "react";

interface Props {
  /** Whether a corridor is currently active */
  active: boolean;
}

/**
 * Predictive ETA countdown for each intersection.
 * When active, shows a countdown "GREEN in Xs" for each intersection
 * based on simulated A* route ETAs.
 */
const INTERSECTIONS = [
  { id: "INT-1", etaOffset: 0 },   // Already green
  { id: "INT-2", etaOffset: 8 },   // 8s away
  { id: "INT-3", etaOffset: 18 },  // 18s away
  { id: "INT-4", etaOffset: 28 },  // 28s away
];

export default function ETACountdown({ active }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [activatedAt, setActivatedAt] = useState(0);

  // Reset timer when corridor activates
  useEffect(() => {
    if (active) {
      const now = Date.now();
      requestAnimationFrame(() => {
        setActivatedAt(now);
        setElapsed(0);
      });
    }
  }, [active]);

  // Tick every second while active
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activatedAt) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [active, activatedAt]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {INTERSECTIONS.map((int) => {
        const remaining = Math.max(0, int.etaOffset - elapsed);
        const isGreen = active && remaining === 0;
        const isPending = active && remaining > 0;

        let statusText = "RED";
        let statusColor = "#f44336";
        if (isGreen) {
          statusText = "GREEN ✓";
          statusColor = "#00e676";
        } else if (isPending) {
          statusText = `GREEN in ${remaining}s`;
          statusColor = "#ffa726";
        }

        return (
          <div
            key={int.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.45rem 0.75rem",
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              borderLeft: `3px solid ${statusColor}`,
              transition: "all 0.3s ease",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                opacity: 0.9,
              }}
            >
              {int.id}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: statusColor,
              }}
            >
              {statusText}
            </span>
          </div>
        );
      })}
    </div>
  );
}
