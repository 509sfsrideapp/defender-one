"use client";

import { useEffect, useState } from "react";
import AppLoadingState from "../components/AppLoadingState";
import DeveloperBackLink from "../components/DeveloperBackLink";

type SubmissionItem = {
  id: string;
  title?: string;
  description?: string;
  contactConsentByPhone?: boolean;
  reporterName?: string;
  reporterPhone?: string;
  reporterUid?: string;
  createdAt?: string;
  respondedAt?: string;
  respondedTitle?: string;
  respondedBody?: string;
};

type SubmissionInboxClientProps = {
  type: "bugReports" | "suggestions";
  title: string;
  description: string;
};

function formatSubmittedAt(value?: string) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString();
}

export default function SubmissionInboxClient({
  type,
  title,
  description,
}: SubmissionInboxClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/developer/submissions?type=${type}`, {
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as
          | { items?: SubmissionItem[]; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Could not load submissions.");
        }

        if (!cancelled) {
          setItems(payload?.items || []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Could not load submissions.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [type]);

  const reloadItems = async () => {
    const response = await fetch(`/api/developer/submissions?type=${type}`, {
      cache: "no-store",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => null)) as
      | { items?: SubmissionItem[]; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Could not load submissions.");
    }

    setItems(payload?.items || []);
  };

  const sendResponse = async (item: SubmissionItem) => {
    const body = (responseDrafts[item.id] || "").trim();

    if (!body) {
      setStatusMessage("Enter a response before sending it.");
      return;
    }

    try {
      setSubmittingId(item.id);
      setStatusMessage("");

      const response = await fetch("/api/developer/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "respond",
          type,
          submissionId: item.id,
          body,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Could not send the response.");
      }

      setResponseDrafts((current) => ({ ...current, [item.id]: "" }));
      setStatusMessage("Response sent to the user inbox.");
      await reloadItems();
    } catch (submitError) {
      setStatusMessage(submitError instanceof Error ? submitError.message : "Could not send the response.");
    } finally {
      setSubmittingId(null);
    }
  };

  const deleteSubmission = async (item: SubmissionItem) => {
    const confirmed = window.confirm("Delete this submission from the developer queue?");

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(item.id);
      setStatusMessage("");

      const response = await fetch(`/api/developer/submissions?type=${type}&submissionId=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Could not delete the submission.");
      }

      setStatusMessage("Submission deleted.");
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (deleteError) {
      setStatusMessage(deleteError instanceof Error ? deleteError.message : "Could not delete the submission.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <AppLoadingState title={`Loading ${title}`} caption="Opening the developer submission inbox." />
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <DeveloperBackLink />
      <h1>{title}</h1>
      <p style={{ maxWidth: 680 }}>{description}</p>

      {error ? <p style={{ color: "#fca5a5" }}>{error}</p> : null}
      {statusMessage ? <p style={{ color: statusMessage.includes("Could not") || statusMessage.includes("Enter a response") ? "#fca5a5" : "#cbd5e1" }}>{statusMessage}</p> : null}

      <section style={{ marginTop: 20 }}>
        {items.length === 0 ? (
          <p>No submissions have been received yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.18)",
                backgroundColor: "rgba(9, 15, 25, 0.88)",
                color: "#e5edf7",
                borderRadius: 12,
                padding: 16,
                marginBottom: 14,
                boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
              }}
            >
              <p><strong>Title:</strong> {item.title || "Untitled Submission"}</p>
              <p><strong>Submitted:</strong> {formatSubmittedAt(item.createdAt)}</p>
              <p><strong>Name:</strong> {item.reporterName || "N/A"}</p>
              <p><strong>Phone:</strong> {item.reporterPhone || "N/A"}</p>
              <p><strong>Phone Contact OK:</strong> {item.contactConsentByPhone ? "Yes" : "No"}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>Description:</strong> {item.description || "N/A"}
              </p>
              {item.respondedAt ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: "rgba(8, 47, 73, 0.28)",
                    border: "1px solid rgba(56, 189, 248, 0.18)",
                  }}
                >
                  <p style={{ margin: 0 }}><strong>Last Response:</strong> {item.respondedTitle || "RE: Submission"}</p>
                  <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>{formatSubmittedAt(item.respondedAt)}</p>
                  <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{item.respondedBody || ""}</p>
                </div>
              ) : null}
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <textarea
                  value={responseDrafts[item.id] || ""}
                  onChange={(event) =>
                    setResponseDrafts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder={`RE: ${item.title || "Submission"}`}
                  rows={4}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    color: "white",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void sendResponse(item)}
                    disabled={submittingId === item.id}
                    style={{ padding: "10px 16px" }}
                  >
                    {submittingId === item.id ? "Sending..." : "Send Response"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSubmission(item)}
                    disabled={deletingId === item.id}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(248, 113, 113, 0.28)",
                      background: "linear-gradient(180deg, rgba(127, 29, 29, 0.92) 0%, rgba(69, 10, 10, 0.98) 100%)",
                      color: "#fee2e2",
                    }}
                  >
                    {deletingId === item.id ? "Deleting..." : "Delete Submission"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
