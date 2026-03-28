"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeIconLink from "../components/HomeIconLink";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { looksLikeEmail, normalizeUsername } from "../../lib/username";

function getLoginErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  switch (code) {
    case "auth/user-disabled":
      return "This account has been frozen. Contact an administrator.";
    case "auth/invalid-credential":
      return "Login failed. Check your username/email and password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a bit.";
    default:
      if (error instanceof Error && error.message) {
        return `Login failed: ${error.message}`;
      }

      return "Login failed.";
  }
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Enter your username or email and password.");

  useEffect(() => {
    setReady(true);
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");

    if (status === "frozen") {
      setStatusMessage("This account has been frozen. Contact an administrator.");
      return;
    }

    if (status === "removed") {
      setStatusMessage("This account has been removed.");
      return;
    }

    setStatusMessage("Enter your username or email and password.");
  }, []);

  const handleLogin = async () => {
    if (!ready) {
      setStatusMessage("Page is still loading. Try again in a moment.");
      return;
    }

    if (!identifier.trim() || !password.trim()) {
      setStatusMessage("Enter your username or email and password.");
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage("Signing in...");
      let loginEmail = identifier.trim();

      if (!looksLikeEmail(loginEmail)) {
        const usernameSnap = await getDoc(doc(db, "usernames", normalizeUsername(loginEmail)));

        if (!usernameSnap.exists()) {
          setStatusMessage("No account was found for that username.");
          return;
        }

        const usernameData = usernameSnap.data() as { email?: string };

        if (!usernameData.email) {
          setStatusMessage("That username is not set up correctly yet.");
          return;
        }

        loginEmail = usernameData.email;
      }

      const credential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const profileSnap = await getDoc(doc(db, "users", credential.user.uid));
      const profile = profileSnap.exists() ? (profileSnap.data() as { accountFrozen?: boolean }) : null;

      if (!profileSnap.exists()) {
        await signOut(auth);
        setStatusMessage("This account has been removed.");
        return;
      }

      if (profile?.accountFrozen) {
        await signOut(auth);
        setStatusMessage("This account has been frozen. Contact an administrator.");
        return;
      }

      setStatusMessage("Login successful. Redirecting...");
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setStatusMessage(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />

      <h1>Login</h1>

      <div style={{ marginTop: 20, maxWidth: 400 }}>
        {statusMessage ? (
          <p
            style={{
              marginBottom: 12,
              color: statusMessage.startsWith("Login failed") ? "#b91c1c" : "#9fd28f",
            }}
          >
            {statusMessage}
          </p>
        ) : null}

        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Username or Email"
          style={{ display: "block", marginBottom: 10, padding: 8, width: "100%" }}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ display: "block", marginBottom: 10, padding: 8, width: "100%" }}
        />

        <button type="button" onClick={handleLogin} style={{ padding: 10 }} disabled={submitting || !ready}>
          Login
        </button>

        <div style={{ marginTop: 16 }}>
          <Link
            href="/admin/login"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              background: "linear-gradient(180deg, rgba(67, 96, 58, 0.96) 0%, rgba(30, 46, 24, 0.98) 100%)",
              color: "white",
              textDecoration: "none",
              borderRadius: 8,
            }}
          >
            Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
