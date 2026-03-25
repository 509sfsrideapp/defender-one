import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export const RIDER_ACTIVE_RIDE_STATUSES = ["open", "accepted", "arrived", "picked_up"] as const;
export const DRIVER_ACTIVE_RIDE_STATUSES = ["accepted", "arrived", "picked_up"] as const;

export type ActiveRideStateRef = {
  id: string;
  status?: string;
  createdAt?: {
    seconds?: number;
    nanoseconds?: number;
  } | null;
};

function sortNewestRide(a: ActiveRideStateRef, b: ActiveRideStateRef) {
  return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
}

export async function getLatestActiveRideForRider(userId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "rides"),
      where("riderId", "==", userId),
      where("status", "in", [...RIDER_ACTIVE_RIDE_STATUSES])
    )
  );

  return (
    snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ActiveRideStateRef, "id">),
      }))
      .sort(sortNewestRide)[0] ?? null
  );
}

export async function getLatestActiveRideForDriver(userId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "rides"),
      where("acceptedBy", "==", userId),
      where("status", "in", [...DRIVER_ACTIVE_RIDE_STATUSES])
    )
  );

  return (
    snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ActiveRideStateRef, "id">),
      }))
      .sort(sortNewestRide)[0] ?? null
  );
}
