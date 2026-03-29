"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import AppLoadingState from "../../../../components/AppLoadingState";
import HomeIconLink from "../../../../components/HomeIconLink";
import { auth, db } from "../../../../../lib/firebase";
import { isAdminEmail } from "../../../../../lib/admin";

type AppUser = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  rank?: string;
  flight?: string;
};

type UserInboxPost = {
  id: string;
  threadId?: string;
  title?: string;
  body?: string;
  senderLabel?: string;
  requiresResponse?: boolean;
  responseSubmittedAt?: { seconds?: number; nanoseconds?: number } | null;
  responseText?: string | null;
  readAt?: { seconds?: number; nanoseconds?: number } | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
};

function formatTimestamp(value?: { seconds?: number; nanoseconds?: number } | null) {
  if (!value?.seconds) {
    return "Pending";
  }

  return new Date(value.seconds * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUserLabel(userProfile: AppUser | null) {
  if (!userProfile) {
    return "User Inbox";
  }

  if (userProfile.rank?.trim() && userProfile.lastName?.trim() && userProfile.firstName?.trim()) {
    return `${userProfile.rank.trim()} ${userProfile.lastName.trim()}, ${userProfile.firstName.trim().charAt(0)}`;
  }

  return userProfile.name || userProfile.email || "User Inbox";
}

export default function AdminUserInboxPage() {
  const params = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [posts, setPosts] = useState<UserInboxPost[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthorized(isAdminEmail(currentUser?.email));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authorized || !params.userId) {
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "users", params.userId), (snapshot) => {
      if (!snapshot.exists()) {
        setTargetUser(null);
        return;
      }

      setTargetUser(snapshot.data() as AppUser);
    });

    return () => unsubscribe();
  }, [authorized, params.userId]);

  useEffect(() => {
    if (!authorized || !params.userId) {
      return;
    }

    const inboxQuery = query(
      collection(db, "userInboxPosts"),
      where("userId", "==", params.userId)
    );

    const unsubscribe = onSnapshot(inboxQuery, (snapshot) => {
      setPosts(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<UserInboxPost, "id">),
        })).sort((left, right) => {
          const rightSeconds = right.createdAt?.seconds ?? 0;
          const leftSeconds = left.createdAt?.seconds ?? 0;
          if (rightSeconds !== leftSeconds) {
            return rightSeconds - leftSeconds;
          }
          return (right.createdAt?.nanoseconds ?? 0) - (left.createdAt?.nanoseconds ?? 0);
        })
      );
    });

    return () => unsubscribe();
  }, [authorized, params.userId]);

  const unreadCount = useMemo(
    () =>
      posts.filter((post) =>
        post.requiresResponse ? !post.responseSubmittedAt : !post.readAt
      ).length,
    [posts]
  );

  if (loading) {
    return <main style={{ padding: 20 }}><AppLoadingState title="Loading Inbox Audit" caption="Preparing user inbox visibility for admin review." /></main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <p>You must sign in to view this page.</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={{ padding: 20 }}>
        <HomeIconLink />
        <p>This account does not have admin access.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <HomeIconLink style={{ marginBottom: 0 }} />
          <Link
            href="/admin/accounts"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 38,
              padding: "8px 14px",
              borderRadius: 10,
              textDecoration: "none",
              background: "linear-gradient(180deg, rgba(71, 104, 145, 0.96) 0%, rgba(34, 54, 84, 0.98) 100%)",
              color: "#ffffff",
              border: "1px solid rgba(126, 142, 160, 0.24)",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: 11,
            }}
          >
            Return to Accounts
          </Link>
        </div>

        <section
          style={{
            borderRadius: 18,
            border: "1px solid rgba(126, 142, 160, 0.18)",
            background: "linear-gradient(180deg, rgba(18, 23, 29, 0.96) 0%, rgba(9, 12, 17, 0.985) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0, 0, 0, 0.3)",
            padding: "1rem 1rem 1.1rem",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontFamily: "var(--font-display)",
              }}
            >
              Admin Inbox Visibility
            </span>
            <h1 style={{ margin: 0 }}>{formatUserLabel(targetUser)}</h1>
            <p style={{ margin: 0, color: "#cbd5e1" }}>
              Reviewing private inbox posts sent directly to this user. Unread status is now based on server-side read receipts, not local browser-only state.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ padding: "7px 11px", borderRadius: 999, backgroundColor: "rgba(15, 23, 42, 0.72)", border: "1px solid rgba(148, 163, 184, 0.18)", fontSize: 12 }}>
              {posts.length} private posts
            </span>
            <span style={{ padding: "7px 11px", borderRadius: 999, backgroundColor: unreadCount > 0 ? "rgba(127, 29, 29, 0.82)" : "rgba(10, 51, 44, 0.82)", border: "1px solid rgba(148, 163, 184, 0.18)", fontSize: 12 }}>
              {unreadCount} unread
            </span>
          </div>
        </section>

        <section style={{ display: "grid", gap: 12 }}>
          {posts.length === 0 ? (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(148, 163, 184, 0.18)",
                backgroundColor: "rgba(9, 15, 25, 0.88)",
                padding: 16,
                color: "#cbd5e1",
              }}
            >
              No private inbox messages have been sent to this user yet.
            </div>
          ) : (
            posts.map((post) => {
              const unread = post.requiresResponse ? !post.responseSubmittedAt : !post.readAt;

              return (
                <article
                  key={post.id}
                  style={{
                    borderRadius: 16,
                    border: unread ? "1px solid rgba(248, 113, 113, 0.32)" : "1px solid rgba(148, 163, 184, 0.18)",
                    backgroundColor: "rgba(9, 15, 25, 0.88)",
                    boxShadow: unread ? "0 12px 30px rgba(127, 29, 29, 0.14)" : "0 12px 32px rgba(2, 6, 23, 0.18)",
                    padding: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                    <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                      <h3 style={{ margin: 0 }}>{post.title || "Untitled Message"}</h3>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
                        {post.senderLabel || "System"} {"//"} {String(post.threadId || "unknown").toUpperCase()} {"//"} Sent {formatTimestamp(post.createdAt)}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, backgroundColor: unread ? "rgba(127, 29, 29, 0.92)" : "rgba(10, 51, 44, 0.88)", color: "white", fontSize: 11 }}>
                        {unread ? "Unread" : "Read"}
                      </span>
                      {post.requiresResponse ? (
                        <span style={{ padding: "6px 10px", borderRadius: 999, backgroundColor: post.responseSubmittedAt ? "rgba(30, 64, 175, 0.88)" : "rgba(120, 53, 15, 0.88)", color: "white", fontSize: 11 }}>
                          {post.responseSubmittedAt ? "Response Submitted" : "Response Required"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#e5edf7", lineHeight: 1.65 }}>
                    {post.body || "No message body."}
                  </p>

                  <div style={{ display: "grid", gap: 6, color: "#cbd5e1", fontSize: 13 }}>
                    <div><strong>Read At:</strong> {post.readAt ? formatTimestamp(post.readAt) : "Not read yet"}</div>
                    {post.requiresResponse ? (
                      <div><strong>Response At:</strong> {post.responseSubmittedAt ? formatTimestamp(post.responseSubmittedAt) : "Waiting on user response"}</div>
                    ) : null}
                    {post.responseSubmittedAt && post.responseText ? (
                      <div>
                        <strong>Response:</strong>
                        <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 10, backgroundColor: "rgba(15, 23, 42, 0.72)", border: "1px solid rgba(148, 163, 184, 0.14)", whiteSpace: "pre-wrap" }}>
                          {post.responseText}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
