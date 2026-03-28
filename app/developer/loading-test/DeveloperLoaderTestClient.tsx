"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DelayedRouteLoading from "../../components/DelayedRouteLoading";

export default function DeveloperLoaderTestClient() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/developer");
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [router]);

  return <DelayedRouteLoading delayMs={0} />;
}
