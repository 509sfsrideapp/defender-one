"use client";

import { useEffect } from "react";
import { attachForegroundNotificationListener } from "../../lib/push-notifications";

export default function ForegroundNotificationBridge() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void attachForegroundNotificationListener().then((detach) => {
      unsubscribe = detach;
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return null;
}
