"use client";

import { useEffect, useState } from "react";
import AppLoadingState from "../components/AppLoadingState";
import HomeIconLink from "../components/HomeIconLink";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import MessagesAppClient from "./MessagesAppClient";

export default function MessagesPage() {
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
    return <main style={{ padding: 20 }}><AppLoadingState title="Loading Messages" caption="Opening your message channels and conversation buckets." /></main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <h1>Messages</h1>
        <p>You need to log in first.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />
      <MessagesAppClient userId={user.uid} />
    </main>
  );
}
