"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Total corridors cleared — used to compute lives impacted */
  corridorsCleared: number;
}

/**
 * Animated "Estimated Lives Impacted" counter.
 * Formula from the SRS: corridors_cleared × 0.05
 * Displays with a smooth count-up animation.
 */
export default function LivesImpactedCounter({ corridorsCleared }: Props) {
  const target = Math.round(corridorsCleared * 0.05 * 100) / 100; // e.g. 7.1
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef({ value: 0, time: 0 });

  useEffect(() => {
    const duration = 800; // ms for animation
    const start = display;
    const startTime = performance.now();
    startRef.current = { value: start, time: startTime };

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (target - start) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "1rem",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.5,
          marginBottom: "0.35rem",
        }}
      >
        Estimated Lives Impacted
      </div>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "#00e676",
          textShadow: "0 0 20px rgba(0,230,118,0.4)",
        }}
      >
        {display.toFixed(1)}
      </div>
    </div>
  );
}
