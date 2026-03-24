"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLoadingState from "../../components/AppLoadingState";
import HomeIconLink from "../../components/HomeIconLink";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

type UserProfile = {
  emergencyRideAddressConsent?: boolean;
};

export default function AccountPermissionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [emergencyRideAddressConsent, setEmergencyRideAddressConsent] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        const data = snap.exists() ? (snap.data() as UserProfile) : null;
        setEmergencyRideAddressConsent(Boolean(data?.emergencyRideAddressConsent));
      } catch (error) {
        console.error(error);
        setStatusMessage("Could not load app permissions.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const savePermissions = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setStatusMessage("Saving app permissions...");
      await updateDoc(doc(db, "users", user.uid), {
        emergencyRideAddressConsent,
      });
      setStatusMessage("App permissions updated.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not save app permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main style={{ padding: 20 }}><AppLoadingState title="Loading App Permissions" caption="Opening your permission and emergency ride settings." /></main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <h1>App Permissions</h1>
        <p>You need to log in first.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />
      <h1>App Permissions</h1>
      <p style={{ maxWidth: 760 }}>
        Review and update the permissions that control emergency ride behavior and future app access options.
      </p>

      {statusMessage ? <p style={{ marginTop: 12 }}>{statusMessage}</p> : null}

      <div
        style={{
          marginTop: 20,
          maxWidth: 760,
          padding: 18,
          borderRadius: 16,
          border: "1px solid rgba(148, 163, 184, 0.18)",
          backgroundColor: "rgba(9, 15, 25, 0.88)",
          boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Emergency Ride Address Sharing</h2>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <input
            type="checkbox"
            checked={emergencyRideAddressConsent}
            onChange={(event) => setEmergencyRideAddressConsent(event.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            I understand that requesting an Emergency Ride will automatically share my saved pickup address with the
            assigned driver. This is intended to speed up the request process when I may be impaired. If I do not
            agree, I will be required to manually enter my pickup location each time, which may delay assistance.
          </span>
        </label>

        <p style={{ marginTop: 14, color: "#94a3b8" }}>
          If this is turned on, the home screen Emergency Ride button becomes a one-tap request using your saved
          address. If it is turned off, the button opens the normal request screen instead.
        </p>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={savePermissions} disabled={saving}>
            {saving ? "Saving..." : "Save Permissions"}
          </button>
          <Link
            href="/account"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 10,
              backgroundColor: "#111827",
              color: "white",
              textDecoration: "none",
            }}
          >
            Back to Account Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
