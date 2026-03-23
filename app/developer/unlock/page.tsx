"use client";

import { useState } from "react";
import HomeIconLink from "../../components/HomeIconLink";

const PIN_LENGTH = 4;
const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function DeveloperUnlockPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const appendDigit = (digit: string) => {
    setCode((current) => (current.length < PIN_LENGTH ? `${current}${digit}` : current));
    setStatusMessage("");
  };

  const removeDigit = () => {
    setCode((current) => current.slice(0, -1));
    setStatusMessage("");
  };

  const clearCode = () => {
    setCode("");
    setStatusMessage("");
  };

  const submitCode = async () => {
    if (code.length !== PIN_LENGTH) {
      setStatusMessage("Enter all four digits.");
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage("Checking developer access...");

      const response = await fetch("/api/developer/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const details = (await response.json().catch(() => null)) as { message?: string } | null;
        setStatusMessage(details?.message || "Developer access denied.");
        return;
      }

      window.location.href = "/developer";
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not verify developer access.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="vault-screen">
      <div className="vault-shell">
        <div className="vault-topbar">
          <HomeIconLink style={{ marginBottom: 0 }} />
          <span className="vault-badge">Restricted</span>
        </div>

        <div className="vault-panel">
          <p className="vault-kicker">Developer Vault</p>
          <h1>Access Terminal</h1>

          <div className="vault-display" aria-label="PIN entry">
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <span
                key={index}
                className={`vault-dot ${index < code.length ? "vault-dot-filled" : ""}`}
              />
            ))}
          </div>

          {statusMessage ? <p className="vault-status">{statusMessage}</p> : <div className="vault-status-spacer" />}

          <div className="vault-keypad">
            {keypadDigits.map((digit) => (
              <button
                key={digit}
                type="button"
                className="vault-key"
                onClick={() => appendDigit(digit)}
                disabled={submitting || code.length >= PIN_LENGTH}
              >
                {digit}
              </button>
            ))}

            <button type="button" className="vault-key vault-key-muted" onClick={clearCode} disabled={submitting}>
              CLR
            </button>
            <button type="button" className="vault-key" onClick={() => appendDigit("0")} disabled={submitting || code.length >= PIN_LENGTH}>
              0
            </button>
            <button type="button" className="vault-key vault-key-muted" onClick={removeDigit} disabled={submitting || code.length === 0}>
              DEL
            </button>
          </div>

          <button type="button" className="vault-submit" onClick={submitCode} disabled={submitting}>
            {submitting ? "Authorizing..." : "Unlock"}
          </button>
        </div>
      </div>
    </main>
  );
}
