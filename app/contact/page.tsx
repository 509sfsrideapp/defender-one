"use client";

import HomeIconLink from "../components/HomeIconLink";

const PHONE_NUMBER = "352-223-7260";
const PHONE_HREF = "tel:3522237260";
const TEXT_HREF = "sms:3522237260";

const actionStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  borderRadius: 10,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
} satisfies React.CSSProperties;

export default function ContactPage() {
  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />
      <h1>Contact</h1>
      <p style={{ maxWidth: 680, color: "#cbd5e1", lineHeight: 1.6 }}>
        If something requires immediate attention, please call or text me directly and I will respond as soon as possible.
      </p>

      <div
        style={{
          marginTop: 20,
          maxWidth: 680,
          padding: 18,
          borderRadius: 16,
          border: "1px solid rgba(148, 163, 184, 0.18)",
          backgroundColor: "rgba(9, 15, 25, 0.88)",
          boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
          display: "grid",
          gap: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Direct Contact
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>
            {PHONE_NUMBER}
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href={TEXT_HREF} style={{ ...actionStyle, backgroundColor: "#1d4ed8" }}>
            Text
          </a>
          <a href={PHONE_HREF} style={{ ...actionStyle, backgroundColor: "#0f766e" }}>
            Call
          </a>
        </div>
      </div>
    </main>
  );
}
