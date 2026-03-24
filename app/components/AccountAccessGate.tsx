"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { isAdminEmail } from "../../lib/admin";

export default function AccountAccessGate() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribeUserDoc = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeUserDoc();

      if (!currentUser || isAdminEmail(currentUser.email)) {
        return;
      }

      unsubscribeUserDoc = onSnapshot(
        doc(db, "users", currentUser.uid),
        async (snapshot) => {
          const data = snapshot.exists() ? (snapshot.data() as { accountFrozen?: boolean }) : null;

          if (!snapshot.exists()) {
            await signOut(auth).catch(() => undefined);
            router.replace("/login?status=removed");
            return;
          }

          if (data?.accountFrozen) {
            await signOut(auth).catch(() => undefined);
            router.replace("/login?status=frozen");
          }
        },
        async () => {
          await signOut(auth).catch(() => undefined);
          router.replace("/login");
        }
      );
    });

    return () => {
      unsubscribeUserDoc();
      unsubscribeAuth();
    };
  }, [router]);

  return null;
}
