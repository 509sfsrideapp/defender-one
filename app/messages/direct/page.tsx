"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLoadingState from "../../components/AppLoadingState";

export default function DirectMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/messages?tab=direct");
  }, [router]);

  return (
    <main style={{ padding: 20 }}>
      <AppLoadingState
        title="Opening Messages"
        caption="Redirecting you into the direct-message inbox."
      />
    </main>
  );
}
