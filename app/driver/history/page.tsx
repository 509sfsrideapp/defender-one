"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Ride = {
  id: string;
  riderName?: string;
  pickup?: string;
  destination?: string;
  status?: string;
  createdAt?: { seconds?: number };
};

export default function DriverHistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const ridesQuery = query(collection(db, "rides"), where("acceptedBy", "==", user.uid));
    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rideList = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Ride, "id">),
        }))
        .filter((ride) => ride.status === "completed" || ride.status === "canceled")
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

      setRides(rideList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <main style={{ padding: 20 }}><p>Loading driver history...</p></main>;
  }

  return (
    <main style={{ padding: 20 }}>
      <Link
        href="/driver"
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
        Driver Dashboard
      </Link>

      <h1>Driver History</h1>

      {rides.length === 0 ? (
        <p>No completed or canceled driver rides yet.</p>
      ) : (
        rides.map((ride) => (
          <div
            key={ride.id}
            style={{
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              color: "#111827",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
              maxWidth: 560,
            }}
          >
            <p><strong>Status:</strong> {ride.status}</p>
            <p><strong>Rider:</strong> {ride.riderName || "N/A"}</p>
            <p><strong>Pickup:</strong> {ride.pickup || "N/A"}</p>
            <p><strong>Destination:</strong> {ride.destination || "N/A"}</p>
          </div>
        ))
      )}
    </main>
  );
}
