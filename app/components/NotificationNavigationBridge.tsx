"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type ServiceWorkerMessage = {
  type?: string;
  target?: string;
};

function normalizeTarget(target: string | null) {
  if (!target) return null;

  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  return target.startsWith("/") ? target : `/${target}`;
}

export default function NotificationNavigationBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestedTarget = normalizeTarget(searchParams.get("notificationTarget"));

    if (requestedTarget && requestedTarget !== pathname) {
      router.replace(requestedTarget);
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent<ServiceWorkerMessage>) => {
      if (event.data?.type !== "OPEN_NOTIFICATION_TARGET") {
        return;
      }

      const target = normalizeTarget(event.data.target);

      if (target && target !== pathname) {
        router.replace(target);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [pathname, router]);

  return null;
}
