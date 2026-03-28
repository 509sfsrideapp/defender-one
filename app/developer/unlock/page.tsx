"use client";

import { useEffect, useState } from "react";
import HomeIconLink from "../../components/HomeIconLink";

const PIN_LENGTH = 4;
const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function DeveloperUnlockPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [detonating, setDetonating] = useState(false);

  useEffect(() => {
    if (countdown === null) {
      return;
    }

    if (countdown <= 0) {
      setDetonating(true);
      const redirectTimer = window.setTimeout(() => {
        window.location.href = "/";
      }, 700);

      return () => window.clearTimeout(redirectTimer);
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const appendDigit = (digit: string) => {
    if (countdown !== null) {
      return;
    }
    setCode((current) => (current.length < PIN_LENGTH ? `${current}${digit}` : current));
    setStatusMessage("");
  };

  const removeDigit = () => {
    if (countdown !== null) {
      return;
    }
    setCode((current) => current.slice(0, -1));
    setStatusMessage("");
  };

  const clearCode = () => {
    if (countdown !== null) {
      return;
    }
    setCode("");
    setStatusMessage("");
  };

  const startSelfDestruct = () => {
    setCode("");
    setSubmitting(false);
    setStatusMessage("Incorrect PIN. Initiating self destruct.");
    setCountdown(5);
  };

  const submitCode = async () => {
    if (countdown !== null) {
      return;
    }

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
        await response.json().catch(() => null);
        startSelfDestruct();
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
    <main className={`vault-screen${detonating ? " vault-screen-detonating" : ""}`}>
      <div className="vault-shell">
        <div className="vault-topbar">
          <HomeIconLink style={{ marginBottom: 0 }} />
          <span className="vault-badge">Restricted</span>
        </div>

        <div className="vault-panel">
          <p className="vault-kicker">Developer Vault</p>
          <h1>Access Terminal</h1>

          <div className="vault-digital-screen" aria-live="polite">
            <span className="vault-digital-screen-line">
              {countdown === null ? "SECURE CHANNEL STANDBY" : "INCORRECT PIN DETECTED"}
            </span>
            <span className="vault-digital-screen-line vault-digital-screen-line-secondary">
              {countdown === null ? "ENTER AUTHORIZATION CODE" : `SELF DESTRUCT IN T-MINUS ${countdown}`}
            </span>
          </div>

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
                disabled={submitting || code.length >= PIN_LENGTH || countdown !== null}
              >
                {digit}
              </button>
            ))}

            <button type="button" className="vault-key vault-key-muted" onClick={clearCode} disabled={submitting || countdown !== null}>
              CLR
            </button>
            <button type="button" className="vault-key" onClick={() => appendDigit("0")} disabled={submitting || code.length >= PIN_LENGTH || countdown !== null}>
              0
            </button>
            <button type="button" className="vault-key vault-key-muted" onClick={removeDigit} disabled={submitting || code.length === 0 || countdown !== null}>
              DEL
            </button>
          </div>

          <button type="button" className="vault-submit" onClick={submitCode} disabled={submitting || countdown !== null}>
            {submitting ? "Authorizing..." : "Unlock"}
          </button>
        </div>
      </div>
    </main>
  );
}
