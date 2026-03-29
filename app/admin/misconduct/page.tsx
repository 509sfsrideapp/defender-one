"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import AppLoadingState from "../../components/AppLoadingState";
import HomeIconLink from "../../components/HomeIconLink";
import { auth } from "../../../lib/firebase";
import { isAdminEmail } from "../../../lib/admin";
import { formatMisconductTargetTypeLabel, type MisconductReportRecord } from "../../../lib/misconduct";

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

export default function AdminMisconductPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<MisconductReportRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [actingOnReportId, setActingOnReportId] = useState("");
  const [resolutionMessages, setResolutionMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser || !isAdminEmail(currentUser.email)) {
        setLoading(false);
        return;
      }

      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/admin/misconduct-reports", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          items?: MisconductReportRecord[];
        };

        if (!response.ok) {
          throw new Error(payload.error || "Could not load misconduct reports.");
        }

        setReports(payload.items || []);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Could not load misconduct reports.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <main style={{ padding: 20 }}><AppLoadingState title="Loading Misconduct Queue" caption="Preparing the admin moderation board." /></main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <h1>Misconduct Reports</h1>
        <p>You need to log in first.</p>
      </main>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <h1>Misconduct Reports</h1>
        <p>This account does not have admin access.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <HomeIconLink style={{ marginBottom: 0 }} />
          <Link href="/admin" style={primaryButtonStyle}>
            Admin Dashboard
          </Link>
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
            <h1 style={{ margin: "4px 0 0" }}>Misconduct Reports</h1>
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6 }}>
              Review user reports, decide whether the selected content should stay up or be removed, and send the outcome back into the reporter&apos;s Admin inbox.
            </p>
          </div>

          {statusMessage ? (
            <p style={{ margin: 0, color: statusMessage.toLowerCase().includes("could not") ? "#fca5a5" : "#bfdbfe" }}>
              {statusMessage}
            </p>
          ) : null}

          {reports.length === 0 ? (
            <p style={{ margin: 0, color: "#cbd5e1" }}>No misconduct reports are in the queue right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {reports.map((report) => {
                const busy = actingOnReportId === report.id;
                const resolved = report.status !== "open";

                return (
                  <div
                    key={report.id}
                    style={{
                      borderRadius: 16,
                      border: "1px solid rgba(126, 142, 160, 0.18)",
                      background: "linear-gradient(180deg, rgba(12, 17, 23, 0.98) 0%, rgba(7, 10, 14, 0.995) 100%)",
                      padding: 16,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <strong>{report.targetLabel}</strong>
                        <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
                          {formatMisconductTargetTypeLabel(report.targetType)}
                          {" // "}
                          Reporter: {report.reporterLabel}
                        </p>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: report.status === "open" ? "rgba(127, 29, 29, 0.88)" : "rgba(16, 58, 49, 0.86)",
                          color: report.status === "open" ? "#fecaca" : "#ccfbf1",
                          fontSize: 11,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {report.status === "open" ? "Open" : report.status === "deleted" ? "Deleted" : "Allowed"}
                      </span>
                    </div>

                    {report.targetPreview ? (
                      <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.55 }}>{report.targetPreview}</p>
                    ) : null}

                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(248, 113, 113, 0.14)",
                        background: "rgba(35, 14, 18, 0.62)",
                        padding: 12,
                      }}
                    >
                      <strong style={{ display: "block", marginBottom: 6 }}>Reporter Reason</strong>
                      <p style={{ margin: 0, color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{report.description}</p>
                    </div>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "#94a3b8", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-display)" }}>
                        Optional Message Back to Reporter
                      </span>
                      <textarea
                        value={resolutionMessages[report.id] || ""}
                        onChange={(event) =>
                          setResolutionMessages((current) => ({
                            ...current,
                            [report.id]: event.target.value,
                          }))
                        }
                        rows={4}
                        disabled={resolved || busy}
                        placeholder="Optional explanation that will be delivered into the reporter&apos;s Admin inbox."
                        style={{ resize: "vertical" }}
                      />
                    </label>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link
                        href={report.targetPath}
                        style={{
                          ...primaryButtonStyle,
                          background: "linear-gradient(180deg, rgba(39, 50, 68, 0.96) 0%, rgba(19, 28, 40, 0.98) 100%)",
                        }}
                      >
                        Open Selected Content
                      </Link>
                      {!resolved ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              const idToken = await auth.currentUser?.getIdToken();

                              if (!idToken) {
                                setStatusMessage("Your admin session expired. Please sign in again.");
                                return;
                              }

                              try {
                                setActingOnReportId(report.id);
                                setStatusMessage("");
                                const response = await fetch(`/api/admin/misconduct-reports/${report.id}`, {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                  body: JSON.stringify({
                                    action: "allow",
                                    message: resolutionMessages[report.id] || "",
                                  }),
                                });

                                const payload = (await response.json().catch(() => ({}))) as { error?: string };

                                if (!response.ok) {
                                  throw new Error(payload.error || "Could not allow the content.");
                                }

                                setReports((current) =>
                                  current.map((item) =>
                                    item.id === report.id
                                      ? {
                                          ...item,
                                          status: "allowed",
                                          resolutionAction: "allow",
                                          resolutionMessage: resolutionMessages[report.id] || "",
                                        }
                                      : item
                                  )
                                );
                              } catch (error) {
                                setStatusMessage(error instanceof Error ? error.message : "Could not allow the content.");
                              } finally {
                                setActingOnReportId("");
                              }
                            }}
                            style={{
                              ...primaryButtonStyle,
                              background: "linear-gradient(180deg, rgba(30, 70, 63, 0.96) 0%, rgba(16, 45, 41, 0.99) 100%)",
                              opacity: busy ? 0.72 : 1,
                            }}
                          >
                            {busy ? "Working..." : "Allow Content"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              const confirmed = window.confirm("Delete the selected content and resolve this report?");

                              if (!confirmed) {
                                return;
                              }

                              const idToken = await auth.currentUser?.getIdToken();

                              if (!idToken) {
                                setStatusMessage("Your admin session expired. Please sign in again.");
                                return;
                              }

                              try {
                                setActingOnReportId(report.id);
                                setStatusMessage("");
                                const response = await fetch(`/api/admin/misconduct-reports/${report.id}`, {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                  body: JSON.stringify({
                                    action: "delete",
                                    message: resolutionMessages[report.id] || "",
                                  }),
                                });

                                const payload = (await response.json().catch(() => ({}))) as { error?: string };

                                if (!response.ok) {
                                  throw new Error(payload.error || "Could not delete the selected content.");
                                }

                                setReports((current) =>
                                  current.map((item) =>
                                    item.id === report.id
                                      ? {
                                          ...item,
                                          status: "deleted",
                                          resolutionAction: "delete",
                                          resolutionMessage: resolutionMessages[report.id] || "",
                                        }
                                      : item
                                  )
                                );
                              } catch (error) {
                                setStatusMessage(error instanceof Error ? error.message : "Could not delete the selected content.");
                              } finally {
                                setActingOnReportId("");
                              }
                            }}
                            style={{
                              minHeight: 42,
                              padding: "10px 16px",
                              borderRadius: 12,
                              border: "1px solid rgba(248, 113, 113, 0.28)",
                              background: "linear-gradient(180deg, rgba(127, 29, 29, 0.92) 0%, rgba(69, 10, 10, 0.98) 100%)",
                              color: "#fee2e2",
                              fontFamily: "var(--font-display)",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              fontSize: 12,
                              opacity: busy ? 0.72 : 1,
                            }}
                          >
                            {busy ? "Working..." : "Delete Content"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
