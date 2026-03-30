"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { beginDirectMessagePresenceSession } from "../../lib/direct-message-live";

export default function MessagePresenceBridge() {
  useEffect(() => {
    let disposePresenceSession: (() => Promise<void>) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      void (async () => {
        if (disposePresenceSession) {
          await disposePresenceSession().catch(() => undefined);
          disposePresenceSession = null;
        }

        if (!currentUser) {
          return;
        }

        disposePresenceSession = await beginDirectMessagePresenceSession(currentUser.uid).catch(
          () => null
        );
      })();
    });

    return () => {
      unsubscribe();
      if (disposePresenceSession) {
        void disposePresenceSession().catch(() => undefined);
      }
    };
  }, []);

  return null;
}
