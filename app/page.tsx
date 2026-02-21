"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import ETACountdown from "./components/ETACountdown";
import LivesImpactedCounter from "./components/LivesImpactedCounter";

// Dynamically import components that need browser APIs (no SSR)
const LiveMap = dynamic(() => import("./components/LiveMap"), { ssr: false });
const CorridorLineChart = dynamic(() => import("./components/CorridorLineChart"), { ssr: false });
const ClearanceBarChart = dynamic(() => import("./components/ClearanceBarChart"), { ssr: false });

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

// ── Config ─────────────────────────────────────────────────────────────
const INTERSECTIONS = ["INT-1", "INT-2", "INT-3", "INT-4"] as const;
const GREEN_DURATION_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;

// ── Dashboard ──────────────────────────────────────────────────────────
export default function Home() {
  const [activeUntil, setActiveUntil] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState(0);
  const [corridorsCleared, setCorridorsCleared] = useState(142); // Pre-loaded demo state (T-6.3)
  const [alertsSent, setAlertsSent] = useState(18);
  const [isGreen, setIsGreen] = useState(false);
  const [mode, setMode] = useState<"vision" | "gps_fallback">("vision");

  // Keep isGreen in sync with activeUntil via timeout
  useEffect(() => {
    const remaining = activeUntil - Date.now();
    if (remaining <= 0) {
      const id = requestAnimationFrame(() => setIsGreen(false));
      return () => cancelAnimationFrame(id);
    }
    const onId = requestAnimationFrame(() => setIsGreen(true));
    const timeout = setTimeout(() => setIsGreen(false), remaining);
    return () => {
      cancelAnimationFrame(onId);
      clearTimeout(timeout);
    };
  }, [activeUntil]);

  // Handle new detection
  const handleDetection = useCallback(
    (d: Detection) => {
      if (d.receivedAt <= lastReceivedAt) return;
      setLastReceivedAt(d.receivedAt);
      setActiveUntil(Date.now() + GREEN_DURATION_MS);
      setCorridorsCleared((prev) => prev + 1);
      setAlertsSent((prev) => prev + Math.floor(Math.random() * 3) + 1);
      setLogs((old) => {
        const id = old.length > 0 ? old[0].id + 1 : 1;
        return [{ ...d, id }, ...old].slice(0, 100);
      });
    },
    [lastReceivedAt]
  );

  // Poll /api/detection every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/detection");
        const data = await res.json();
        if (data.detection) {
          setMode("vision");
          handleDetection(data.detection);
        }
      } catch {
        /* ignore */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [handleDetection]);

  // ── Render: 3-panel layout ─────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* ─── Top bar ─── */}
      <header style={S.header}>
        <h1 style={S.title}>🚑 GoldenHour — Traffic Control Dashboard</h1>
        <div style={S.modeBadge}>
          <span
            style={{
              ...S.modeIndicator,
              backgroundColor: mode === "vision" ? "#00e676" : "#ffa726",
            }}
          />
          {mode === "vision" ? "AI Vision Mode" : "GPS Beacon Fallback"}
        </div>
      </header>

      {/* ─── KPI Row ─── */}
      <div style={S.kpiRow}>
        {[
          { label: "Corridors Cleared Today", value: corridorsCleared, accent: "#00e676" },
          { label: "Avg Response Time", value: "2.8s", accent: "#42a5f5" },
          { label: "Active Alerts Sent", value: alertsSent, accent: "#ffa726" },
          { label: "Current Status", value: isGreen ? "🟢 ACTIVE" : "🔴 IDLE", accent: isGreen ? "#00e676" : "#ef5350" },
        ].map((kpi) => (
          <div key={kpi.label} style={S.kpiCard}>
            <span style={S.kpiLabel}>{kpi.label}</span>
            <span style={{ ...S.kpiValue, color: kpi.accent }}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* ─── 3-Panel Body ─── */}
      <div style={S.panels}>
        {/* ─── LEFT PANEL: Intersection Status ─── */}
        <aside style={S.leftPanel}>
          <SectionTitle>Intersection Status</SectionTitle>
          <div style={S.intList}>
            {INTERSECTIONS.map((name, idx) => {
              const green = idx === 0 && isGreen;
              return (
                <div key={name} style={S.intRow}>
                  <div
                    style={{
                      ...S.intDot,
                      backgroundColor: green ? "#00e676" : "#f44336",
                      boxShadow: green
                        ? "0 0 12px 4px rgba(0,230,118,0.5)"
                        : "0 0 6px 2px rgba(244,67,54,0.3)",
                    }}
                  />
                  <span style={S.intName}>{name}</span>
                  <span style={{ ...S.intState, color: green ? "#00e676" : "#f44336" }}>
                    {green ? "GREEN" : "RED"}
                  </span>
                </div>
              );
            })}
          </div>

          <SectionTitle style={{ marginTop: "1.25rem" }}>Predictive ETA</SectionTitle>
          <ETACountdown active={isGreen} />

          <div style={{ marginTop: "1.25rem" }}>
            <LivesImpactedCounter corridorsCleared={corridorsCleared} />
          </div>

          {/* Fallback mode toggle for demo (T-5.3) */}
          <button
            style={S.fallbackBtn}
            onClick={() => setMode((m) => (m === "vision" ? "gps_fallback" : "vision"))}
          >
            {mode === "vision" ? "⚠ Simulate Camera Dropout" : "🔄 Restore Vision Mode"}
          </button>
        </aside>

        {/* ─── CENTER PANEL: Live Map ─── */}
        <main style={S.centerPanel}>
          <SectionTitle>Live Corridor Map</SectionTitle>
          <div style={S.mapWrapper}>
            <LiveMap active={isGreen} />
          </div>

          {/* Analytics charts under the map */}
          <div style={S.chartRow}>
            <div style={S.chartBox}>
              <SectionTitle>Corridor Activations (24h)</SectionTitle>
              <CorridorLineChart liveBump={corridorsCleared - 142} />
            </div>
            <div style={S.chartBox}>
              <SectionTitle>Avg Clearance by Intersection</SectionTitle>
              <ClearanceBarChart />
            </div>
          </div>
        </main>

        {/* ─── RIGHT PANEL: Live Log / Alerts ─── */}
        <aside style={S.rightPanel}>
          <SectionTitle>Live Incident Log</SectionTitle>
          <div style={S.logScroll}>
            {logs.length === 0 && (
              <p style={S.logEmpty}>No detections yet — waiting…</p>
            )}
            {logs.map((entry) => (
              <div key={entry.id} style={S.logRow}>
                <div style={S.logRowTop}>
                  <span style={S.logBadge}>{entry.zone}</span>
                  <span style={S.logTime}>
                    {new Date(entry.receivedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div style={S.logRowBottom}>
                  <span>Confidence: <strong>{entry.confidence.toFixed(2)}</strong></span>
                  <span>Video: <strong>{entry.timestamp.toFixed(1)}s</strong></span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Tiny helper component ──────────────────────────────────────────────
function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2
      style={{
        fontSize: "0.85rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        opacity: 0.55,
        marginBottom: "0.6rem",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const CARD_BG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "1px solid rgba(255,255,255,0.08)";

const S: Record<string, React.CSSProperties> = {
  /* ── Page shell ── */
  page: {
    minHeight: "100vh",
    backgroundColor: "#0A2342",
    color: "#fff",
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    padding: "1rem 1.25rem",
  },

  /* ── Header ── */
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  title: {
    fontSize: "1.3rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    margin: 0,
  },
  modeBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: "0.35rem 0.75rem",
    borderRadius: 20,
    border: CARD_BORDER,
  },
  modeIndicator: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },

  /* ── KPI Row ── */
  kpiRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    marginBottom: "1rem",
  },
  kpiCard: {
    flex: "1 1 180px",
    backgroundColor: CARD_BG,
    border: CARD_BORDER,
    borderRadius: 10,
    padding: "1rem 0.75rem",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.35rem",
  },
  kpiLabel: {
    fontSize: "0.65rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    opacity: 0.5,
  },
  kpiValue: {
    fontSize: "1.4rem",
    fontWeight: 700,
  },

  /* ── 3-Panel Grid ── */
  panels: {
    display: "grid",
    gridTemplateColumns: "260px 1fr 300px",
    gap: "1rem",
    flex: 1,
    minHeight: 0,
  },

  /* ── Left Panel ── */
  leftPanel: {
    backgroundColor: CARD_BG,
    border: CARD_BORDER,
    borderRadius: 12,
    padding: "1rem",
    display: "flex",
    flexDirection: "column" as const,
    overflowY: "auto" as const,
  },
  intList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    marginBottom: "0.25rem",
  },
  intRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.4rem 0.5rem",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
  },
  intDot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    flexShrink: 0,
    transition: "all 0.4s ease",
  },
  intName: {
    fontSize: "0.85rem",
    fontWeight: 600,
    flex: 1,
  },
  intState: {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  fallbackBtn: {
    marginTop: "auto",
    paddingTop: "0.75rem",
    padding: "0.5rem",
    backgroundColor: "rgba(255,165,0,0.15)",
    border: "1px solid rgba(255,165,0,0.3)",
    borderRadius: 8,
    color: "#ffa726",
    fontSize: "0.72rem",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center" as const,
  },

  /* ── Center Panel ── */
  centerPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    minWidth: 0,
  },
  mapWrapper: {
    width: "100%",
    height: 380,
    borderRadius: 12,
    overflow: "hidden",
    border: CARD_BORDER,
  },
  chartRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  },
  chartBox: {
    backgroundColor: CARD_BG,
    border: CARD_BORDER,
    borderRadius: 12,
    padding: "1rem",
  },

  /* ── Right Panel ── */
  rightPanel: {
    backgroundColor: CARD_BG,
    border: CARD_BORDER,
    borderRadius: 12,
    padding: "1rem",
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
  },
  logScroll: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  logEmpty: {
    opacity: 0.4,
    fontStyle: "italic",
    fontSize: "0.8rem",
    textAlign: "center" as const,
    marginTop: "2rem",
  },
  logRow: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: "0.5rem 0.6rem",
    borderRadius: 8,
    fontSize: "0.78rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  logRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logRowBottom: {
    display: "flex",
    gap: "1rem",
    opacity: 0.65,
    fontSize: "0.72rem",
  },
  logBadge: {
    backgroundColor: "#1e88e5",
    padding: "0.1rem 0.45rem",
    borderRadius: 4,
    fontSize: "0.68rem",
    fontWeight: 700,
  },
  logTime: {
    opacity: 0.45,
    fontSize: "0.68rem",
  },
};
