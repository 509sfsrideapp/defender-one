"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Ride = {
  id: string;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderEmail?: string;
  pickup?: string;
  destination?: string;
  status?: string;
  driverName?: string;
  driverPhone?: string;
  driverEmail?: string;
  riderLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  driverLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  createdAt?: {
    seconds?: number;
    nanoseconds?: number;
  };
};

const ACTIVE_RIDE_STATUSES = ["open", "accepted", "arrived", "picked_up"] as const;

type Point = {
  latitude: number;
  longitude: number;
};

function getStatusMessage(status?: string) {
  switch (status) {
    case "open":
      return "Your ride request is out to drivers now.";
    case "accepted":
      return "A driver accepted your request and is heading your way.";
    case "arrived":
      return "Your driver has arrived at the pickup location.";
    case "picked_up":
      return "You have been picked up and the ride is in progress.";
    default:
      return "No active ride right now.";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMapPoint(point: Point, bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
  const padding = 16;
  const width = 320;
  const height = 220;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const longitudeRange = Math.max(bounds.maxLon - bounds.minLon, 0.002);
  const latitudeRange = Math.max(bounds.maxLat - bounds.minLat, 0.002);

  const x = padding + ((point.longitude - bounds.minLon) / longitudeRange) * usableWidth;
  const y = padding + (1 - (point.latitude - bounds.minLat) / latitudeRange) * usableHeight;

  return {
    x: clamp(x, padding, width - padding),
    y: clamp(y, padding, height - padding),
  };
}

function LiveRideMap({ riderLocation, driverLocation }: { riderLocation?: Point | null; driverLocation?: Point | null }) {
  if (!riderLocation) {
    return (
      <div
        style={{
          marginTop: 16,
          borderRadius: 12,
          padding: 16,
          backgroundColor: "#f8fafc",
          color: "#334155",
          border: "1px solid #cbd5e1",
          maxWidth: 560,
        }}
      >
        Pickup coordinates are not available yet, so the live map cannot be drawn.
      </div>
    );
  }

  const points = driverLocation ? [riderLocation, driverLocation] : [riderLocation];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const bounds = {
    minLat: Math.min(...latitudes) - 0.001,
    maxLat: Math.max(...latitudes) + 0.001,
    minLon: Math.min(...longitudes) - 0.001,
    maxLon: Math.max(...longitudes) + 0.001,
  };

  const riderPoint = getMapPoint(riderLocation, bounds);
  const driverPoint = driverLocation ? getMapPoint(driverLocation, bounds) : null;

  return (
    <div
      style={{
        marginTop: 16,
        maxWidth: 560,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #bfdbfe",
        background:
          "linear-gradient(180deg, rgba(224,242,254,1) 0%, rgba(239,246,255,1) 52%, rgba(240,253,244,1) 100%)",
      }}
    >
      <div style={{ padding: "12px 14px", color: "#0f172a" }}>
        <strong>Live Tracker</strong>
      </div>

      <svg viewBox="0 0 320 220" style={{ display: "block", width: "100%", height: "auto" }}>
        <defs>
          <pattern id="grid" width="32" height="22" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 22" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="320" height="220" fill="url(#grid)" />
        <path
          d="M0 162 C60 132, 120 188, 180 154 S280 128, 320 146"
          fill="none"
          stroke="rgba(15,118,110,0.18)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {driverPoint ? (
          <line
            x1={driverPoint.x}
            y1={driverPoint.y}
            x2={riderPoint.x}
            y2={riderPoint.y}
            stroke="#1d4ed8"
            strokeDasharray="6 6"
            strokeWidth="2"
          />
        ) : null}

        <circle cx={riderPoint.x} cy={riderPoint.y} r="10" fill="#f97316" />
        <circle cx={riderPoint.x} cy={riderPoint.y} r="4" fill="#fff" />
        <text x={riderPoint.x + 14} y={riderPoint.y + 4} fill="#9a3412" fontSize="12" fontWeight="700">
          Pickup
        </text>

        {driverPoint ? (
          <>
            <circle cx={driverPoint.x} cy={driverPoint.y} r="10" fill="#1d4ed8" />
            <circle cx={driverPoint.x} cy={driverPoint.y} r="4" fill="#fff" />
            <text x={driverPoint.x + 14} y={driverPoint.y + 4} fill="#1e3a8a" fontSize="12" fontWeight="700">
              Driver
            </text>
          </>
        ) : null}
      </svg>

      <div style={{ padding: 14, color: "#0f172a", backgroundColor: "rgba(255,255,255,0.72)" }}>
        {driverLocation ? "Blue is your driver. Orange is your pickup spot." : "Waiting for your driver location to appear."}
      </div>
    </div>
  );
}

export default function RideStatusPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setRides([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const ridesQuery = query(collection(db, "rides"), where("riderId", "==", user.uid));

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rideList = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Ride, "id">),
        }))
        .filter((ride) => ACTIVE_RIDE_STATUSES.includes(ride.status as (typeof ACTIVE_RIDE_STATUSES)[number]))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

      setRides(rideList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const activeRide = useMemo(() => rides[0] ?? null, [rides]);
  const riderLocation =
    activeRide?.riderLocation?.latitude != null && activeRide.riderLocation?.longitude != null
      ? {
          latitude: activeRide.riderLocation.latitude,
          longitude: activeRide.riderLocation.longitude,
        }
      : null;
  const driverLocation =
    activeRide?.driverLocation?.latitude != null && activeRide.driverLocation?.longitude != null
      ? {
          latitude: activeRide.driverLocation.latitude,
          longitude: activeRide.driverLocation.longitude,
        }
      : null;

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <p>Loading ride status...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            marginBottom: 20,
            padding: "8px 14px",
            backgroundColor: "#1f2937",
            color: "white",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          Login
        </Link>
        <p>You need to log in first.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginBottom: 20,
          padding: "8px 14px",
          backgroundColor: "#1f2937",
          color: "white",
          textDecoration: "none",
          borderRadius: 8,
          marginRight: 12,
        }}
      >
        Home
      </Link>

      <Link
        href="/request"
        style={{
          display: "inline-block",
          marginBottom: 20,
          padding: "8px 14px",
          backgroundColor: "#0f766e",
          color: "white",
          textDecoration: "none",
          borderRadius: 8,
        }}
      >
        Request Another Ride
      </Link>

      <h1>Ride Status</h1>

      {!activeRide ? (
        <p>You do not have an active ride right now.</p>
      ) : (
        <>
          <p>{getStatusMessage(activeRide.status)}</p>

          <div
            style={{
              border: "1px solid #0f766e",
              backgroundColor: "#ecfeff",
              color: "#0f172a",
              borderRadius: 12,
              padding: 16,
              maxWidth: 560,
            }}
          >
            <p>
              <strong>Status:</strong> {activeRide.status}
            </p>
            <p>
              <strong>Pickup:</strong> {activeRide.pickup || "N/A"}
            </p>
            <p>
              <strong>Destination:</strong> {activeRide.destination || "N/A"}
            </p>
            <p>
              <strong>Driver:</strong> {activeRide.driverName || "Waiting for driver"}
            </p>
            <p>
              <strong>Driver Phone:</strong> {activeRide.driverPhone || "Not available yet"}
            </p>
            <p>
              <strong>Driver Email:</strong> {activeRide.driverEmail || "Not available yet"}
            </p>
            <p>
              <strong>Driver GPS:</strong>{" "}
              {activeRide.driverLocation?.latitude != null && activeRide.driverLocation?.longitude != null
                ? `${activeRide.driverLocation.latitude.toFixed(6)}, ${activeRide.driverLocation.longitude.toFixed(6)}`
                : "Driver location not shared yet"}
            </p>
            <p>
              <strong>Pickup GPS:</strong>{" "}
              {activeRide.riderLocation?.latitude != null && activeRide.riderLocation?.longitude != null
                ? `${activeRide.riderLocation.latitude.toFixed(6)}, ${activeRide.riderLocation.longitude.toFixed(6)}`
                : "Not shared"}
            </p>
          </div>

          <LiveRideMap riderLocation={riderLocation} driverLocation={driverLocation} />
        </>
      )}
    </main>
  );
}
