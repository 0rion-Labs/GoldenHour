"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────
interface Detection {
  zone: string;
  confidence: number;
  timestamp: number;
  receivedAt: number;
}

interface LogEntry extends Detection {
  id: number;
}

// ── Intersection config ────────────────────────────────────────────────
const INTERSECTIONS = ["INT-1", "INT-2", "INT-3", "INT-4"] as const;
const GREEN_DURATION_MS = 5_000; // revert to red after 5 s
const POLL_INTERVAL_MS = 1_000; // poll every 1 s

// ── Dashboard ──────────────────────────────────────────────────────────
export default function Home() {
  const [activeUntil, setActiveUntil] = useState<number>(0); // epoch ms
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<number>(0);
  const [logCounter, setLogCounter] = useState(0);
  const [corridorsCleared, setCorridorsCleared] = useState(0);

  // Is INT-1 currently green?
  const [isGreen, setIsGreen] = useState(false);

  // Keep isGreen in sync with activeUntil
  useEffect(() => {
    if (activeUntil <= Date.now()) {
      setIsGreen(false);
      return;
    }

    setIsGreen(true);
    const timeout = setTimeout(() => setIsGreen(false), activeUntil - Date.now());
    return () => clearTimeout(timeout);
  }, [activeUntil]);

  // Handle a new detection from the API
  const handleDetection = useCallback(
    (d: Detection) => {
      // Only process genuinely new detections
      if (d.receivedAt <= lastReceivedAt) return;
      setLastReceivedAt(d.receivedAt);

      // Turn INT-1 green for 5 s
      setActiveUntil(Date.now() + GREEN_DURATION_MS);

      // Increment corridors cleared KPI
      setCorridorsCleared((prev) => prev + 1);

      // Append to log (keep last 50 entries)
      setLogCounter((prev) => {
        const id = prev + 1;
        setLogs((oldLogs) => [{ ...d, id }, ...oldLogs].slice(0, 50));
        return id;
      });
    },
    [lastReceivedAt]
  );

  // Poll GET /api/detection every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/detection");
        const data = await res.json();
        if (data.detection) handleDetection(data.detection);
      } catch {
        /* server unreachable – ignore */
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [handleDetection]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <h1 style={styles.title}>🚑 GoldenHour — Traffic Control Dashboard</h1>

      {/* KPI Stats Cards */}
      <div style={styles.kpiRow}>
        {[
          { label: "Corridors Cleared Today", value: corridorsCleared, accent: "#00e676" },
          { label: "Avg Response Time", value: "4.2s", accent: "#42a5f5" },
          { label: "Active Alerts Sent", value: 18, accent: "#ffa726" },
          { label: "Current Status", value: isGreen ? "ACTIVE" : "IDLE", accent: isGreen ? "#00e676" : "#ef5350" },
        ].map((kpi) => (
          <div key={kpi.label} style={styles.kpiCard}>
            <span style={styles.kpiLabel}>{kpi.label}</span>
            <span style={{ ...styles.kpiValue, color: kpi.accent }}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* Intersection circles */}
      <div style={styles.grid}>
        {INTERSECTIONS.map((name, idx) => {
          const green = idx === 0 && isGreen;
          return (
            <div key={name} style={styles.card}>
              <div
                style={{
                  ...styles.circle,
                  backgroundColor: green ? "#00e676" : "#f44336",
                  boxShadow: green
                    ? "0 0 24px 8px rgba(0,230,118,0.6)"
                    : "0 0 12px 4px rgba(244,67,54,0.4)",
                  transition: "all 0.4s ease",
                }}
              />
              <span style={styles.label}>{name}</span>
              <span style={styles.status}>{green ? "GREEN" : "RED"}</span>
            </div>
          );
        })}
      </div>

      {/* Live log */}
      <div style={styles.logContainer}>
        <h2 style={styles.logTitle}>Live Detection Log</h2>
        <div style={styles.logScroll}>
          {logs.length === 0 && (
            <p style={styles.logEmpty}>No detections yet — waiting for data…</p>
          )}
          {logs.map((entry) => (
            <div key={entry.id} style={styles.logRow}>
              <span style={styles.logBadge}>{entry.zone}</span>
              <span style={styles.logText}>
                conf: <strong>{entry.confidence.toFixed(2)}</strong>
              </span>
              <span style={styles.logText}>
                time: <strong>{entry.timestamp.toFixed(1)}s</strong>
              </span>
              <span style={styles.logTime}>
                {new Date(entry.receivedAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inline styles (no extra deps) ──────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0A2342",
    color: "#fff",
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2rem 1rem",
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    marginBottom: "2rem",
    letterSpacing: "0.02em",
  },
  kpiRow: {
    display: "flex",
    gap: "1.25rem",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "2.5rem",
    width: "100%",
    maxWidth: 820,
  },
  kpiCard: {
    flex: "1 1 160px",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "1.25rem 1rem",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.5rem",
  },
  kpiLabel: {
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    opacity: 0.6,
  },
  kpiValue: {
    fontSize: "1.6rem",
    fontWeight: 700,
  },
  grid: {
    display: "flex",
    gap: "2.5rem",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "2.5rem",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: "50%",
  },
  label: {
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: "0.05em",
  },
  status: {
    fontSize: "0.8rem",
    opacity: 0.7,
    textTransform: "uppercase",
  },
  logContainer: {
    width: "100%",
    maxWidth: 720,
    flex: 1,
  },
  logTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
    borderBottom: "1px solid rgba(255,255,255,0.15)",
    paddingBottom: "0.5rem",
  },
  logScroll: {
    maxHeight: 300,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  logEmpty: {
    opacity: 0.5,
    fontStyle: "italic",
  },
  logRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: "0.5rem 0.75rem",
    borderRadius: 6,
    fontSize: "0.85rem",
  },
  logBadge: {
    backgroundColor: "#1e88e5",
    padding: "0.15rem 0.5rem",
    borderRadius: 4,
    fontSize: "0.75rem",
    fontWeight: 700,
  },
  logText: {
    opacity: 0.85,
  },
  logTime: {
    marginLeft: "auto",
    opacity: 0.5,
    fontSize: "0.75rem",
  },
};
