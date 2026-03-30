"use client";

import { onValue, ref, update, type Unsubscribe } from "firebase/database";
import { realtimeDb } from "./firebase";

export type RideLiveState = {
  riderLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  driverLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  riderLocationUpdatedAt?: string | null;
  driverLocationUpdatedAt?: string | null;
};

function getRideLiveRef(rideId: string) {
  return ref(realtimeDb, `rideLive/${rideId}`);
}

export function subscribeToRideLiveState(
  rideId: string,
  onChange: (state: RideLiveState | null) => void
): Unsubscribe {
  return onValue(getRideLiveRef(rideId), (snapshot) => {
    const value = snapshot.val() as RideLiveState | null;
    onChange(value || null);
  });
}

export async function mergeRideLiveState(
  rideId: string,
  value: Partial<RideLiveState>
) {
  await update(getRideLiveRef(rideId), value);
}
