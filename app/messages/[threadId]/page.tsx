"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import AppLoadingState from "../../components/AppLoadingState";
import HomeIconLink from "../../components/HomeIconLink";
import DirectMessageThreadClient from "../DirectMessageThreadClient";
import { auth } from "../../../lib/firebase";

export default function MessageThreadPage() {
  const params = useParams<{ threadId: string }>();
  const searchParams = useSearchParams();
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
    return (
      <main style={{ padding: 20 }}>
        <AppLoadingState
          title="Loading Messages"
          caption="Opening the selected message thread."
        />
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
            padding: "8px 14px",
            backgroundColor: "#1f2937",
            color: "white",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          Login
        </Link>
        <p style={{ marginTop: 20 }}>You need to log in first.</p>
      </main>
    );
  }

  const requestedTab = searchParams.get("tab");

  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />
      <div style={{ marginTop: 18, display: "grid", gap: 5 }}>
        <p
          style={{
            margin: 0,
            color: "#94a3b8",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "var(--font-display)",
          }}
        >
          Direct, marketplace, and ISO conversation routing
        </p>
        <h1 style={{ margin: 0 }}>Messages</h1>
      </div>
      <div style={{ marginTop: 16 }}>
        <DirectMessageThreadClient
          userId={user.uid}
          conversationId={params.threadId}
          requestedTab={
            requestedTab === "direct" ||
            requestedTab === "marketplace" ||
            requestedTab === "iso"
              ? requestedTab
              : null
          }
        />
      </div>
    </main>
  );
}
