"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLoadingState from "../components/AppLoadingState";
import HomeIconLink from "../components/HomeIconLink";
import LiveRideMap, { type MapPoint } from "../components/LiveRideMap";
import { auth, db } from "../../lib/firebase";
import { formatRideTimestamp, getRideStatusLabel } from "../../lib/ride-lifecycle";
import { ADMIN_EMAIL, isAdminEmail } from "../../lib/admin";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";

type Ride = {
  id: string;
  riderName?: string;
  riderPhone?: string;
  pickup?: string;
  pickupLocationName?: string;
  pickupLocationAddress?: string;
  destination?: string;
  status?: string;
  driverName?: string;
  riderLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  driverLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  acceptedBy?: string;
  createdAt?: { seconds?: number };
  acceptedAt?: { seconds?: number };
  arrivedAt?: { seconds?: number };
  pickedUpAt?: { seconds?: number };
  completedAt?: { seconds?: number };
  canceledAt?: { seconds?: number };
};

type AppUser = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  available?: boolean;
  carYear?: string;
  carMake?: string;
  carModel?: string;
  carColor?: string;
  carPlate?: string;
  driverPhotoUrl?: string;
};

const featureCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  backgroundColor: "rgba(9, 15, 25, 0.88)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
};

const featureLinkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  backgroundColor: "#0f172a",
  color: "white",
  textDecoration: "none",
  borderRadius: 10,
  border: "1px solid rgba(96, 165, 250, 0.18)",
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedDriversByRide, setSelectedDriversByRide] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthorized(isAdminEmail(currentUser?.email));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authorized) return;

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList: AppUser[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AppUser, "id">),
      }));
      setUsers(userList);
    });

    const ridesQuery = query(collection(db, "rides"), orderBy("createdAt", "desc"));
    const unsubscribeRides = onSnapshot(ridesQuery, (snapshot) => {
      const rideList: Ride[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Ride, "id">),
      }));
      setRides(rideList);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeRides();
    };
  }, [authorized]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      alert("Logout failed");
    }
  };

  const cancelRide = async (rideId: string) => {
    const confirmed = window.confirm("Cancel this ride?");
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "rides", rideId), {
        status: "canceled",
        canceledAt: new Date(),
        canceledBy: user?.uid ?? "admin",
      });
    } catch (error) {
      console.error(error);
      alert("Could not cancel the ride.");
    }
  };

  const reassignRide = async (rideId: string) => {
    const confirmed = window.confirm("Return this ride to the open queue so another driver can accept it?");
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "rides", rideId), {
        status: "open",
        acceptedBy: null,
        driverName: null,
        driverPhone: null,
        driverEmail: null,
        driverPhotoUrl: null,
        acceptedAt: null,
        arrivedAt: null,
        pickedUpAt: null,
        completedAt: null,
        canceledAt: null,
        carMake: null,
        carModel: null,
        carColor: null,
        carPlate: null,
        driverLocation: null,
        reassignedAt: new Date(),
      });
    } catch (error) {
      console.error(error);
      alert("Could not reassign the ride.");
    }
  };

  const clockOutDriver = async (driverId: string, driverName?: string) => {
    const confirmed = window.confirm(`Clock out ${driverName || "this driver"}?`);
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "users", driverId), {
        available: false,
      });
    } catch (error) {
      console.error(error);
      alert("Could not clock out that driver.");
    }
  };

  const assignRideToDriver = async (rideId: string) => {
    const driverId = selectedDriversByRide[rideId];

    if (!driverId) {
      alert("Select a driver first.");
      return;
    }

    const driver = users.find((appUser) => appUser.id === driverId);

    if (!driver) {
      alert("That driver is no longer available.");
      return;
    }

    try {
      await updateDoc(doc(db, "rides", rideId), {
        status: "accepted",
        acceptedBy: driver.id,
        driverName: driver.name || null,
        driverPhone: driver.phone || null,
        driverEmail: driver.email || null,
        driverPhotoUrl: driver.driverPhotoUrl || null,
        carYear: driver.carYear || null,
        carMake: driver.carMake || null,
        carModel: driver.carModel || null,
        carColor: driver.carColor || null,
        carPlate: driver.carPlate || null,
        acceptedAt: new Date(),
        arrivedAt: null,
        pickedUpAt: null,
        completedAt: null,
        canceledAt: null,
        assignedByAdminAt: new Date(),
        assignedByAdminUid: user?.uid ?? "admin",
      });
    } catch (error) {
      console.error(error);
      alert("Could not assign that ride.");
    }
  };

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <AppLoadingState title="Loading Admin Dashboard" caption="Building the ride board and driver availability view." />
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <Link
          href="/admin/login"
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
          Admin Login
        </Link>
        <p>You must sign in to view the admin page.</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <p>This account does not have admin access.</p>
        <p>Authorized admin email: {ADMIN_EMAIL}</p>
      </main>
    );
  }

  const completedRides = rides.filter((ride) => ride.status === "completed");
  const activeRideBoard = rides.filter(
    (ride) =>
      ride.status === "open" ||
      ride.status === "accepted" ||
      ride.status === "arrived" ||
      ride.status === "picked_up"
  );
  const availableDrivers = users.filter((appUser) => appUser.available);

  return (
    <main style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <HomeIconLink style={{ marginRight: 12, marginBottom: 0 }} />

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 14px",
            backgroundColor: "#7f1d1d",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <h1>Admin Dashboard</h1>
      <p>
        <strong>Signed in as:</strong> {user.email}
      </p>

      <section
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <div style={featureCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: 10 }}>Account Manager</h2>
          <p style={{ marginTop: 0, marginBottom: 14, color: "#cbd5e1" }}>
            <strong>Total Accounts:</strong> {users.length}
          </p>
          <Link href="/admin/accounts" style={featureLinkStyle}>
            Open Accounts
          </Link>
        </div>

        <div style={featureCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: 10 }}>Ride History</h2>
          <p style={{ marginTop: 0, marginBottom: 14, color: "#cbd5e1" }}>
            <strong>Total Rides Given:</strong> {completedRides.length}
          </p>
          <Link href="/admin/history" style={featureLinkStyle}>
            Open Ride History
          </Link>
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <div style={featureCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Still Needing a Home</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/audit" style={featureLinkStyle}>
              Audit Log
            </Link>
            <Link href="/admin/inbox" style={featureLinkStyle}>
              Admin Messages
            </Link>
            <Link href="/admin/misconduct" style={featureLinkStyle}>
              Misconduct Queue
            </Link>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Available Drivers</h2>
        {availableDrivers.length === 0 ? (
          <p>No drivers are currently clocked in.</p>
        ) : (
          availableDrivers.map((driver) => (
            <div
              key={driver.id}
              style={{
                border: "1px solid rgba(96, 165, 250, 0.2)",
                backgroundColor: "rgba(10, 16, 27, 0.86)",
                color: "#e5edf7",
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
              }}
            >
              <p>
                <strong>Name:</strong> {driver.name || "N/A"}
              </p>
              <p>
                <strong>Email:</strong> {driver.email || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {driver.phone || "N/A"}
              </p>
              <p>
                <strong>Vehicle:</strong>{" "}
                {[driver.carColor, driver.carYear, driver.carMake, driver.carModel].filter(Boolean).join(" ").trim() || "N/A"}
              </p>
              <p>
                <strong>Plate:</strong> {driver.carPlate || "N/A"}
              </p>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => void clockOutDriver(driver.id, driver.name)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 40,
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(248, 113, 113, 0.24)",
                    background: "linear-gradient(180deg, rgba(123, 36, 36, 0.96) 0%, rgba(84, 25, 25, 0.98) 100%)",
                    color: "#fff5f5",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontSize: 11,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 24px rgba(69, 10, 10, 0.22)",
                  }}
                >
                  Clock Out Driver
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Live Ride Board</h2>
        <p style={{ maxWidth: 720 }}>
          This board stays focused on open and active rides. Completed and canceled rides are kept on the separate ride history screen.
        </p>
        {activeRideBoard.length === 0 ? (
          <p>No open or active rides right now.</p>
        ) : (
          activeRideBoard.map((ride) => (
            <div
              key={ride.id}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.18)",
                backgroundColor: "rgba(9, 15, 25, 0.88)",
                color: "#e5edf7",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
                boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
              }}
            >
              <p>
                <strong>Status:</strong> {getRideStatusLabel(ride.status)}
              </p>
              <p>
                <strong>Rider:</strong> {ride.riderName || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {ride.riderPhone || "N/A"}
              </p>
              <p>
                <strong>Pickup:</strong> {ride.pickupLocationName || ride.pickupLocationAddress || ride.pickup || "N/A"}
              </p>
              {ride.pickupLocationAddress && ride.pickupLocationAddress !== ride.pickupLocationName ? (
                <p>
                  <strong>Address:</strong> {ride.pickupLocationAddress}
                </p>
              ) : null}
              <p>
                <strong>Rider GPS:</strong>{" "}
                {ride.riderLocation?.latitude != null && ride.riderLocation?.longitude != null
                  ? `${ride.riderLocation.latitude.toFixed(6)}, ${ride.riderLocation.longitude.toFixed(6)}`
                  : "Not shared"}
              </p>
              <p>
                <strong>Destination:</strong> {ride.destination || "N/A"}
              </p>
              <p>
                <strong>Driver:</strong> {ride.driverName || "Unassigned"}
              </p>
              <p>
                <strong>Requested:</strong> {formatRideTimestamp(ride.createdAt) || "N/A"}
              </p>
              <p>
                <strong>Accepted:</strong> {formatRideTimestamp(ride.acceptedAt) || "N/A"}
              </p>
              <p>
                <strong>Arrived:</strong> {formatRideTimestamp(ride.arrivedAt) || "N/A"}
              </p>
              <p>
                <strong>Picked Up:</strong> {formatRideTimestamp(ride.pickedUpAt) || "N/A"}
              </p>
              <p>
                <strong>Driver GPS:</strong>{" "}
                {ride.driverLocation?.latitude != null && ride.driverLocation?.longitude != null
                  ? `${ride.driverLocation.latitude.toFixed(6)}, ${ride.driverLocation.longitude.toFixed(6)}`
                  : "Not shared"}
              </p>

              {ride.status === "open" || ride.status === "accepted" || ride.status === "arrived" || ride.status === "picked_up" ? (
                <div style={{ marginTop: 12 }}>
                  {ride.status === "open" ? (
                    <div style={{ marginBottom: 12, maxWidth: 360 }}>
                      <label style={{ display: "block", marginBottom: 8 }}>
                        <strong>Assign Driver:</strong>
                      </label>
                      <select
                        value={selectedDriversByRide[ride.id] || ""}
                        onChange={(event) =>
                          setSelectedDriversByRide((current) => ({
                            ...current,
                            [ride.id]: event.target.value,
                          }))
                        }
                        style={{ marginBottom: 10 }}
                      >
                        <option value="">Select a clocked-in driver</option>
                        {availableDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name || driver.email || driver.id}
                            {[driver.carColor, driver.carYear, driver.carMake, driver.carModel]
                              .filter(Boolean)
                              .join(" ")
                              .trim()
                              ? ` - ${[driver.carColor, driver.carYear, driver.carMake, driver.carModel].filter(Boolean).join(" ").trim()}`
                              : ""}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => assignRideToDriver(ride.id)}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "#0f766e",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          marginRight: 10,
                        }}
                      >
                        Assign Ride
                      </button>
                    </div>
                  ) : null}

                  <button
                    onClick={() => cancelRide(ride.id)}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#b91c1c",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      marginRight: 10,
                    }}
                  >
                    Cancel Ride
                  </button>

                  {ride.status !== "open" ? (
                    <button
                      onClick={() => reassignRide(ride.id)}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#92400e",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                      }}
                    >
                      Reassign Ride
                    </button>
                  ) : null}
                </div>
              ) : null}

              {ride.status === "accepted" || ride.status === "arrived" || ride.status === "picked_up" ? (
                <LiveRideMap
                  riderLocation={
                    ride.riderLocation?.latitude != null && ride.riderLocation?.longitude != null
                      ? ({
                          latitude: ride.riderLocation.latitude,
                          longitude: ride.riderLocation.longitude,
                        } satisfies MapPoint)
                      : null
                  }
                  driverLocation={
                    ride.driverLocation?.latitude != null && ride.driverLocation?.longitude != null
                      ? ({
                          latitude: ride.driverLocation.latitude,
                          longitude: ride.driverLocation.longitude,
                        } satisfies MapPoint)
                      : null
                  }
                  title="Dispatch Map"
                  emptyLabel="No rider coordinates have been shared for this active ride yet."
                  footerLabel="Blue is the driver. Orange is the pickup spot."
                  maxWidth={700}
                />
              ) : null}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
