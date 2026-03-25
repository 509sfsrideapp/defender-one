"use client";

import { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  DRIVER_ACTIVE_RIDE_STATUSES,
  RIDER_ACTIVE_RIDE_STATUSES,
  type ActiveRideStateRef as ActiveRideRef,
} from "./ride-state";

function sortNewestRide(a: ActiveRideRef, b: ActiveRideRef) {
  return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
}

export function useActiveRides(user: User | null) {
  const [state, setState] = useState<{
    userId: string | null;
    riderActiveRide: ActiveRideRef | null;
    driverActiveRide: ActiveRideRef | null;
    riderReady: boolean;
    driverReady: boolean;
  }>({
    userId: null,
    riderActiveRide: null,
    driverActiveRide: null,
    riderReady: false,
    driverReady: false,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    const riderQuery = query(collection(db, "rides"), where("riderId", "==", user.uid));
    const unsubscribeRider = onSnapshot(riderQuery, (snapshot) => {
      const nextRide =
        snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ActiveRideRef, "id">),
          }))
          .filter((ride) =>
            RIDER_ACTIVE_RIDE_STATUSES.includes(ride.status as (typeof RIDER_ACTIVE_RIDE_STATUSES)[number])
          )
          .sort(sortNewestRide)[0] ?? null;

      setState((current) => ({
        userId: user.uid,
        riderActiveRide: nextRide,
        driverActiveRide: current.userId === user.uid ? current.driverActiveRide : null,
        riderReady: true,
        driverReady: current.userId === user.uid ? current.driverReady : false,
      }));
    });

    const driverQuery = query(collection(db, "rides"), where("acceptedBy", "==", user.uid));
    const unsubscribeDriver = onSnapshot(driverQuery, (snapshot) => {
      const nextRide =
        snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ActiveRideRef, "id">),
          }))
          .filter((ride) =>
            DRIVER_ACTIVE_RIDE_STATUSES.includes(ride.status as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number])
          )
          .sort(sortNewestRide)[0] ?? null;

      setState((current) => ({
        userId: user.uid,
        riderActiveRide: current.userId === user.uid ? current.riderActiveRide : null,
        driverActiveRide: nextRide,
        riderReady: current.userId === user.uid ? current.riderReady : false,
        driverReady: true,
      }));
    });

    return () => {
      unsubscribeRider();
      unsubscribeDriver();
    };
  }, [user]);

  if (!user) {
    return {
      riderActiveRide: null,
      driverActiveRide: null,
      loading: false,
    };
  }

  if (state.userId !== user.uid) {
    return {
      riderActiveRide: null,
      driverActiveRide: null,
      loading: true,
    };
  }

  return {
    riderActiveRide: state.riderActiveRide,
    driverActiveRide: state.driverActiveRide,
    loading: !state.riderReady || !state.driverReady,
  };
}
