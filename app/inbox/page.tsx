"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import AppLoadingState from "../components/AppLoadingState";
import HomeIconLink from "../components/HomeIconLink";
import InboxPageClient from "../messages/InboxPageClient";
import { auth } from "../../lib/firebase";

export default function InboxPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <main style={{ padding: 20 }}><AppLoadingState title="Loading Inbox" caption="Opening your system inbox channels." /></main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <h1>Inbox</h1>
        <p>You need to log in first.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />
      <div style={{ marginTop: 18, display: "grid", gap: 5 }}>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "var(--font-display)" }}>
          Notifications, admin notices, and developer follow-up
        </p>
        <h1 style={{ margin: 0 }}>Inbox</h1>
      </div>
      <InboxPageClient userId={user.uid} />
    </main>
  );
}
