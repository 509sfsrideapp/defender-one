"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTrackedHistory, setTrackedHistory } from "./NavigationHistoryTracker";

type BackIconButtonProps = {
  style?: React.CSSProperties;
};

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  backgroundColor: "#1f2937",
  color: "white",
  textDecoration: "none",
  borderRadius: 999,
  border: "1px solid rgba(148, 163, 184, 0.16)",
  boxShadow: "0 10px 24px rgba(2, 6, 23, 0.18)",
  cursor: "pointer",
};

export default function BackIconButton({ style }: BackIconButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [backTarget, setBackTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const history = getTrackedHistory();

      if (history[history.length - 1] !== pathname) {
        setBackTarget(history[history.length - 1] ?? null);
        return;
      }

      setBackTarget(history[history.length - 2] ?? null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const handleBack = () => {
    if (backTarget) {
      const history = getTrackedHistory();
      const targetIndex = history.lastIndexOf(backTarget);

      if (targetIndex >= 0) {
        setTrackedHistory(history.slice(0, targetIndex + 1));
      }

      router.push(backTarget);
      return;
    }

    router.push("/");
  };

  if (!backTarget) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={handleBack}
      style={{ ...baseStyle, ...style }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M10.75 4.5 3.5 12l7.25 7.5 2.1-2.1-3.55-3.65H20.5v-3.5H9.3l3.55-3.65-2.1-2.1Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
