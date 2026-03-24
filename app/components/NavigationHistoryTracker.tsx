"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const STORAGE_KEY = "app-nav-history";

function shouldTrackPath(pathname: string) {
  return pathname !== "/login" && pathname !== "/admin/login";
}

export function getTrackedHistory() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setTrackedHistory(history: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-25)));
}

export default function NavigationHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !shouldTrackPath(pathname)) {
      return;
    }

    const history = getTrackedHistory();

    if (history[history.length - 1] === pathname) {
      return;
    }

    setTrackedHistory([...history, pathname]);
  }, [pathname]);

  return null;
}
