"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLoadingState from "../../components/AppLoadingState";
import HomeIconLink from "../../components/HomeIconLink";
import { auth } from "../../../lib/firebase";

type AuditRecord = {
  id: string;
  action?: string;
  actorEmail?: string | null;
  actorUid?: string | null;
  targetType?: string;
  targetId?: string;
  status?: "success" | "failure" | "info";
  message?: string;
  createdAt?: string;
  details?: Record<string, unknown>;
};

function formatAuditDate(value?: string) {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function AdminAuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAuditLog = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();

        if (!idToken) {
          setError("Admin sign-in is required.");
          setLoading(false);
          return;
        }

        const response = await fetch("/api/admin/audit", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        const payload = (await response.json().catch(() => null)) as { records?: AuditRecord[]; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Could not load audit records.");
        }

        setRecords(payload?.records || []);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Could not load audit records.");
      } finally {
        setLoading(false);
      }
    };

    void loadAuditLog();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <AppLoadingState title="Loading Audit Log" caption="Pulling backend activity records for admin review." />
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <HomeIconLink style={{ marginBottom: 0 }} />
        <Link
          href="/admin"
          style={{
            display: "inline-block",
            padding: "8px 14px",
            backgroundColor: "#243326",
            color: "white",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          Admin Dashboard
        </Link>
      </div>

      <h1>Admin Audit Log</h1>
      <p style={{ maxWidth: 760 }}>
        This page shows recent backend actions and important operational events so admin can trace what happened without digging through raw logs.
      </p>

      {error ? <p style={{ color: "#fca5a5" }}>{error}</p> : null}

      {records.length === 0 ? (
        <p>No audit records found yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {records.map((record) => (
            <div
              key={record.id}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.18)",
                backgroundColor: "rgba(11, 16, 10, 0.88)",
                color: "#e5edf7",
                borderRadius: 12,
                padding: 14,
                boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
              }}
            >
              <p><strong>Action:</strong> {record.action || "N/A"}</p>
              <p><strong>Status:</strong> {record.status || "info"}</p>
              <p><strong>When:</strong> {formatAuditDate(record.createdAt)}</p>
              <p><strong>Actor:</strong> {record.actorEmail || record.actorUid || "System"}</p>
              <p><strong>Target:</strong> {[record.targetType, record.targetId].filter(Boolean).join(" / ") || "N/A"}</p>
              <p><strong>Message:</strong> {record.message || "No message recorded."}</p>
              {record.details && Object.keys(record.details).length > 0 ? (
                <pre
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: "rgba(18, 28, 16, 0.72)",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(record.details, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
