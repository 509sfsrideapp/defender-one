"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type RouteReadyShellProps = {
  children: React.ReactNode;
};

export default function RouteReadyShell({ children }: RouteReadyShellProps) {
  const pathname = usePathname();
  const hasMountedRef = useRef(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const startTimer = window.setTimeout(() => {
      setTransitioning(true);
    }, 0);

    const timer = window.setTimeout(() => {
      setTransitioning(false);
    }, 260);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <div className="route-ready-shell">
      {transitioning ? <div className="route-ready-shell-overlay" aria-hidden="true" /> : null}
      <div className={`route-ready-shell-content${transitioning ? " route-ready-shell-content-hidden" : ""}`}>
        {children}
      </div>
    </div>
  );
}
