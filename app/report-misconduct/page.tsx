"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import AppLoadingState from "../components/AppLoadingState";
import HomeIconLink from "../components/HomeIconLink";
import {
  clearStoredMisconductTarget,
  getStoredMisconductTarget,
  useMisconductReportMode,
} from "../components/MisconductReporting";
import { auth } from "../../lib/firebase";
import { formatMisconductTargetTypeLabel, type MisconductTargetSelection } from "../../lib/misconduct";

const sectionStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(126, 142, 160, 0.18)",
  background: "linear-gradient(180deg, rgba(18, 23, 29, 0.96) 0%, rgba(9, 12, 17, 0.985) 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0, 0, 0, 0.3)",
  padding: "1rem 1rem 1.1rem",
};

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

export default function ReportMisconductPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<MisconductTargetSelection | null>(null);
  const [description, setDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setActive } = useMisconductReportMode();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    setTarget(getStoredMisconductTarget());

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <main style={{ padding: 20 }}><AppLoadingState title="Loading Report Form" caption="Preparing the misconduct submission flow." /></main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <h1>Report Misconduct</h1>
        <p>You need to log in first.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <HomeIconLink style={{ marginBottom: 0 }} />
          {target?.targetPath ? (
            <Link href={target.targetPath} style={primaryButtonStyle}>
              Return to Selected Content
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              clearStoredMisconductTarget();
              setTarget(null);
              setDescription("");
              setStatusMessage("");
              setActive(true);
            }}
            style={{
              ...primaryButtonStyle,
              background: "linear-gradient(180deg, rgba(39, 50, 68, 0.96) 0%, rgba(19, 28, 40, 0.98) 100%)",
            }}
          >
            Pick Another Item
          </button>
        </div>

        <section style={{ ...sectionStyle, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 6 }}>
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
              Admin moderation queue
            </p>
            <h1 style={{ margin: "4px 0 0" }}>Report Misconduct</h1>
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6 }}>
              Pick the exact post, comment, event, listing, or request that needs review, then explain why it should be looked at. Admin will review it and send the decision back into your Admin inbox.
            </p>
          </div>

          {target ? (
            <div
              style={{
                borderRadius: 14,
                border: "1px solid rgba(248, 113, 113, 0.18)",
                background: "linear-gradient(180deg, rgba(35, 14, 18, 0.82) 0%, rgba(17, 9, 12, 0.96) 100%)",
                padding: 14,
                display: "grid",
                gap: 8,
              }}
            >
              <strong style={{ display: "block" }}>Selected Content</strong>
              <p style={{ margin: 0, color: "#fecaca" }}>{formatMisconductTargetTypeLabel(target.targetType)}</p>
              <p style={{ margin: 0, color: "#f8fafc" }}>{target.targetLabel}</p>
              {target.targetPreview ? (
                <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.55 }}>{target.targetPreview}</p>
              ) : null}
            </div>
          ) : (
            <div
              style={{
                borderRadius: 14,
                border: "1px dashed rgba(126, 142, 160, 0.18)",
                background: "rgba(12, 18, 26, 0.72)",
                padding: 14,
                display: "grid",
                gap: 8,
              }}
            >
              <strong>No content selected yet</strong>
              <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.55 }}>
                Tap <strong>Pick Another Item</strong>, then tap the exact content on screen that you want to report.
              </p>
            </div>
          )}

          <label style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "var(--font-display)",
              }}
            >
              Why is this misconduct?
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              placeholder="Describe what happened and why this content should be reviewed."
              style={{ resize: "vertical" }}
            />
          </label>

          {statusMessage ? (
            <p style={{ margin: 0, color: statusMessage.toLowerCase().includes("could not") || statusMessage.toLowerCase().includes("required") ? "#fca5a5" : "#bfdbfe" }}>
              {statusMessage}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={submitting || !target}
              onClick={async () => {
                if (!target) {
                  setStatusMessage("Pick the content you want to report first.");
                  return;
                }

                if (!description.trim()) {
                  setStatusMessage("A misconduct description is required.");
                  return;
                }

                const idToken = await auth.currentUser?.getIdToken();

                if (!idToken) {
                  setStatusMessage("Your session expired. Please sign in again.");
                  return;
                }

                try {
                  setSubmitting(true);
                  setStatusMessage("");

                  const response = await fetch("/api/misconduct-reports", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                      target,
                      description: description.trim(),
                    }),
                  });

                  const payload = (await response.json().catch(() => ({}))) as { error?: string };

                  if (!response.ok) {
                    throw new Error(payload.error || "Could not send the misconduct report.");
                  }

                  clearStoredMisconductTarget();
                  setTarget(null);
                  setDescription("");
                  setStatusMessage("Report sent. Admin will review it and follow up in your Admin inbox.");
                } catch (error) {
                  setStatusMessage(error instanceof Error ? error.message : "Could not send the misconduct report.");
                } finally {
                  setSubmitting(false);
                }
              }}
              style={{
                ...primaryButtonStyle,
                opacity: submitting || !target ? 0.72 : 1,
                cursor: submitting || !target ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Sending..." : "Submit Report"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
