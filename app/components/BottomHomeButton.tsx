"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomHomeButton() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        padding: "10px 16px 0",
      }}
    >
      <Link
        href="/"
        aria-label="Home"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 50,
          height: 50,
          background: "linear-gradient(180deg, rgba(37, 43, 52, 0.98) 0%, rgba(13, 18, 24, 1) 100%)",
          color: "#f8fafc",
          textDecoration: "none",
          borderRadius: 12,
          border: "1px solid rgba(126, 142, 160, 0.26)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 28px rgba(0, 0, 0, 0.34)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 auto auto 0",
            width: "100%",
            height: 2,
            background: "linear-gradient(90deg, rgba(240, 206, 114, 0.88), rgba(95, 136, 187, 0.52), transparent 78%)",
          }}
        />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 10.5L12 4L20 10.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 9.5V19H17.5V9.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19V13.5H14V19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}
