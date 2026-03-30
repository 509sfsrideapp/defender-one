"use client";

import { onDisconnect, ref, remove, update } from "firebase/database";
import { realtimeDb } from "./firebase";

export type DriverPresenceRecord = {
  available: boolean;
  flight?: string | null;
  visibleOpenRideCount?: number;
  source?: string | null;
  heartbeatAt?: string | null;
};

function getDriverPresenceRef(userId: string) {
  return ref(realtimeDb, `driverPresence/${userId}`);
}

export async function publishDriverPresence(
  userId: string,
  value: DriverPresenceRecord
) {
  await update(getDriverPresenceRef(userId), {
    ...value,
    heartbeatAt: new Date().toISOString(),
  });
}

export async function clearDriverPresence(userId: string) {
  await remove(getDriverPresenceRef(userId));
}

export async function beginDriverPresenceSession(userId: string) {
  const presenceRef = getDriverPresenceRef(userId);
  const disconnectHandler = onDisconnect(presenceRef);
  await disconnectHandler.remove();

  return async () => {
    await disconnectHandler.cancel().catch(() => undefined);
  };
}
