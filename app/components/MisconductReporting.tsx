"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MisconductTargetSelection } from "../../lib/misconduct";

const REPORT_MODE_STORAGE_KEY = "defender_one_misconduct_report_mode";
const REPORT_TARGET_STORAGE_KEY = "defender_one_misconduct_report_target";
const REPORT_MODE_EVENT = "defender:misconduct-report-mode";

function readReportMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(REPORT_MODE_STORAGE_KEY) === "active";
}

export function setMisconductReportMode(active: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (active) {
    window.sessionStorage.setItem(REPORT_MODE_STORAGE_KEY, "active");
  } else {
    window.sessionStorage.removeItem(REPORT_MODE_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(REPORT_MODE_EVENT, {
      detail: { active },
    })
  );
}

export function storeMisconductTarget(target: MisconductTargetSelection) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(REPORT_TARGET_STORAGE_KEY, JSON.stringify(target));
}

export function clearStoredMisconductTarget() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(REPORT_TARGET_STORAGE_KEY);
}

export function getStoredMisconductTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(REPORT_TARGET_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as MisconductTargetSelection;
  } catch {
    return null;
  }
}

export function useMisconductReportMode() {
  const [active, setActive] = useState(() => readReportMode());

  useEffect(() => {
    const syncMode = (event: Event) => {
      const customEvent = event as CustomEvent<{ active?: boolean }>;
      setActive(Boolean(customEvent.detail?.active));
    };

    const syncFromStorage = () => {
      setActive(readReportMode());
    };

    window.addEventListener(REPORT_MODE_EVENT, syncMode as EventListener);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(REPORT_MODE_EVENT, syncMode as EventListener);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  return {
    active,
    setActive: setMisconductReportMode,
  };
}

export function ReportMisconductButton() {
  const pathname = usePathname();
  const { active, setActive } = useMisconductReportMode();

  const isReportPage = pathname === "/report-misconduct";

  return (
    <button
      type="button"
      onClick={() => {
        if (!active) {
          clearStoredMisconductTarget();
        }

        setActive(!active);
      }}
      style={{
        display: "inline-block",
        textDecoration: "none",
        color: active ? "#fca5a5" : "#8ea0b3",
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
      aria-pressed={active}
      title={
        isReportPage
          ? "Toggle misconduct selection mode"
          : active
            ? "Cancel misconduct selection mode"
            : "Turn on misconduct selection mode and tap the item you want to report"
      }
    >
      {active ? "Cancel Report" : "Report Misconduct"}
    </button>
  );
}

type ReportableTargetProps = {
  target: MisconductTargetSelection;
  children: ReactNode;
  style?: CSSProperties;
};

export function ReportableTarget({ target, children, style }: ReportableTargetProps) {
  const router = useRouter();
  const { active, setActive } = useMisconductReportMode();

  const activeStyle = useMemo<CSSProperties>(() => {
    if (!active) {
      return {};
    }

    return {
      position: "relative",
      cursor: "crosshair",
      outline: "2px dashed rgba(248, 113, 113, 0.7)",
      outlineOffset: 6,
      borderRadius: 18,
      boxShadow: "0 0 0 1px rgba(127, 29, 29, 0.28), 0 0 0 6px rgba(127, 29, 29, 0.08)",
    };
  }, [active]);

  return (
    <div
      style={{
        ...style,
        ...activeStyle,
      }}
      onClickCapture={(event) => {
        if (!active) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        storeMisconductTarget(target);
        setActive(false);
        router.push("/report-misconduct");
      }}
    >
      {active ? (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 4,
            pointerEvents: "none",
            display: "inline-flex",
            alignItems: "center",
            padding: "7px 10px",
            borderRadius: 999,
            background: "rgba(69, 10, 10, 0.9)",
            color: "#fecaca",
            border: "1px solid rgba(248, 113, 113, 0.28)",
            fontFamily: "var(--font-display)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 12px 20px rgba(41, 10, 16, 0.24)",
          }}
        >
          Tap to Report This
        </div>
      ) : null}
      {children}
    </div>
  );
}
