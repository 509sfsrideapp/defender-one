"use client";

import Link from "next/link";
import HomeIconLink from "../../components/HomeIconLink";
import InboxPostComposer from "../../components/InboxPostComposer";

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "10px 16px",
  borderRadius: 12,
  textDecoration: "none",
  background: "linear-gradient(180deg, rgba(71, 104, 145, 0.96) 0%, rgba(34, 54, 84, 0.98) 100%)",
  color: "#ffffff",
  border: "1px solid rgba(126, 142, 160, 0.24)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 28px rgba(17, 24, 39, 0.26)",
  fontFamily: "var(--font-display)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontSize: 12,
};

export default function AdminInboxPage() {
  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <HomeIconLink style={{ marginBottom: 0 }} />
          <Link href="/admin" style={primaryButtonStyle}>
            Return to Admin
          </Link>
          <Link href="/admin/inbox/manage" style={primaryButtonStyle}>
            Review Sent Messages
          </Link>
        </div>

        <InboxPostComposer
          endpoint="/api/admin/inbox-posts"
          threadId="admin"
          heading="Send Admin Message"
          description="Publish an administrative message to the user inbox. Title and message text are required, and an optional photo appears on the left side of the post."
          submitLabel="Send Message"
        />
      </div>
    </main>
  );
}
