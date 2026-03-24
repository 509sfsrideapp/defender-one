"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function DeveloperAccessCleaner() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/developer")) {
      return;
    }

    fetch("/api/developer/logout", {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
