"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import {
  APP_HOMEPAGE_REVEAL_KEY,
  APP_PIN_LENGTH,
  APP_STARTUP_SESSION_KEY,
  isStoredAppPinEnabled,
  verifyStoredAppPin,
  type StoredAppPinSettings,
} from "../../lib/app-pin";

type InitialAppSplashProps = {
  forceReplay?: boolean;
};

type UserAccessProfile = StoredAppPinSettings & {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rank?: string | null;
  flight?: string | null;
  riderPhotoUrl?: string | null;
  driverPhotoUrl?: string | null;
};

type AccessPhase =
  | "booting"
  | "pin"
  | "identifying"
  | "granted"
  | "closing"
  | "hidden";

type BootMode = "signed_out" | "authenticated" | "post_pin";

const FULL_BOOT_LINES = [
  "INITIALIZING SYSTEM ASSETS",
  "LOADING APP MODULES",
  "SYNCING SECURE SERVICES",
  "RETRIEVING USER PROFILE",
  "VERIFYING SESSION",
  "USER IDENTIFIED",
];

const POST_PIN_LINES = [
  "RETRIEVING USER PROFILE",
  "VERIFYING SESSION",
  "USER IDENTIFIED",
];

const SIGNED_OUT_LINES = [
  "INITIALIZING SYSTEM ASSETS",
  "LOADING APP MODULES",
  "SYNCING SECURE SERVICES",
  "VERIFYING SESSION",
  "TERMINAL READY",
];

function buildUserDisplayName(profile: UserAccessProfile | null, user: User | null) {
  const rank = profile?.rank?.trim() || "";
  const firstName = profile?.firstName?.trim() || "";
  const lastName = profile?.lastName?.trim() || "";
  const fallbackName = profile?.name?.trim() || user?.displayName?.trim() || user?.email?.split("@")[0] || "Authorized User";

  if (rank && lastName && firstName) {
    return `${rank} ${lastName}, ${firstName}`;
  }

  if (rank && lastName) {
    return `${rank} ${lastName}`;
  }

  return fallbackName;
}

function buildUserSubLabel(profile: UserAccessProfile | null, user: User | null) {
  const office = profile?.flight?.trim() || "";
  const email = user?.email?.trim() || "";

  if (office && email) {
    return `${email} // ${office}`;
  }

  return office || email || "SESSION PROFILE VERIFIED";
}

function getUserPhoto(profile: UserAccessProfile | null) {
  return profile?.driverPhotoUrl?.trim() || profile?.riderPhotoUrl?.trim() || "";
}

export default function InitialAppSplash({ forceReplay = false }: InitialAppSplashProps) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<AccessPhase>("booting");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserAccessProfile | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [bootMode, setBootMode] = useState<BootMode | null>(null);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [submittingPin, setSubmittingPin] = useState(false);

  const shouldRun = forceReplay || pathname === "/";
  const accessGrantedLabel = currentUser ? "ACCESS GRANTED" : "TERMINAL READY";
  const userDisplayName = useMemo(
    () => buildUserDisplayName(profile, currentUser),
    [currentUser, profile]
  );
  const userSubLabel = useMemo(
    () => buildUserSubLabel(profile, currentUser),
    [currentUser, profile]
  );
  const userPhotoUrl = useMemo(() => getUserPhoto(profile), [profile]);
  const pinEnabled = isStoredAppPinEnabled(profile);
  const currentBootLines =
    bootMode === "post_pin"
      ? POST_PIN_LINES
      : bootMode === "authenticated"
        ? FULL_BOOT_LINES
        : SIGNED_OUT_LINES;

  useEffect(() => {
    if (typeof window === "undefined" || !shouldRun) {
      setPhase("hidden");
      return;
    }

    if (!forceReplay && window.sessionStorage.getItem(APP_STARTUP_SESSION_KEY) === "true") {
      setPhase("hidden");
      return;
    }

    setPhase("booting");
  }, [forceReplay, shouldRun]);

  useEffect(() => {
    if (!shouldRun || phase === "hidden") {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setProfile(null);
        setAuthResolved(true);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        setProfile(snapshot.exists() ? (snapshot.data() as UserAccessProfile) : null);
      } catch (error) {
        console.error(error);
        setProfile(null);
      } finally {
        setAuthResolved(true);
      }
    });

    return () => unsubscribe();
  }, [phase, shouldRun]);

  useEffect(() => {
    if (!shouldRun || phase === "hidden" || !authResolved || phase !== "booting") {
      return;
    }

    if (currentUser && pinEnabled) {
      setPhase("pin");
      return;
    }

    setBootMode(currentUser ? "authenticated" : "signed_out");
    setPhase("identifying");
  }, [authResolved, currentUser, phase, pinEnabled, shouldRun]);

  useEffect(() => {
    if (phase !== "identifying" || !bootMode) {
      return;
    }

    setVisibleLines([]);

    const timers = currentBootLines.map((line, index) =>
      window.setTimeout(() => {
        setVisibleLines((current) => [...current, line]);
      }, index * 520)
    );

    const grantedTimer = window.setTimeout(() => {
      setPhase("granted");
    }, currentBootLines.length * 520 + 1100);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(grantedTimer);
    };
  }, [bootMode, currentBootLines, phase]);

  useEffect(() => {
    if (phase !== "granted") {
      return;
    }

    const closingTimer = window.setTimeout(() => {
      setPhase("closing");
    }, 900);

    const finishTimer = window.setTimeout(() => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(APP_STARTUP_SESSION_KEY, "true");
        window.sessionStorage.setItem(APP_HOMEPAGE_REVEAL_KEY, `${Date.now()}`);
      }
      setPhase("hidden");
    }, 1500);

    return () => {
      window.clearTimeout(closingTimer);
      window.clearTimeout(finishTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "pin") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        setPinError("");
        setPinValue((current) => (current.length < APP_PIN_LENGTH ? `${current}${event.key}` : current));
        return;
      }

      if (event.key === "Backspace") {
        setPinValue((current) => current.slice(0, -1));
        return;
      }

      if (event.key === "Escape") {
        setPinValue("");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void (async () => {
          if (!profile?.appPinSalt || !profile.appPinHash) {
            return;
          }

          if (pinValue.length !== APP_PIN_LENGTH) {
            setPinError("Enter the full four-digit PIN.");
            return;
          }

          try {
            setSubmittingPin(true);
            const valid = await verifyStoredAppPin(pinValue, profile.appPinSalt, profile.appPinHash);

            if (!valid) {
              setPinError("Incorrect PIN. Try again.");
              setPinValue("");
              return;
            }

            setPinError("");
            setPinValue("");
            setBootMode("post_pin");
            setPhase("identifying");
          } catch (error) {
            console.error(error);
            setPinError("PIN validation is temporarily unavailable.");
          } finally {
            setSubmittingPin(false);
          }
        })();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, pinValue, profile]);

  const submitPin = async () => {
    if (!profile?.appPinSalt || !profile.appPinHash) {
      setPhase("identifying");
      setBootMode("authenticated");
      return;
    }

    if (pinValue.length !== APP_PIN_LENGTH) {
      setPinError("Enter the full four-digit PIN.");
      return;
    }

    try {
      setSubmittingPin(true);
      const valid = await verifyStoredAppPin(pinValue, profile.appPinSalt, profile.appPinHash);

      if (!valid) {
        setPinError("Incorrect PIN. Try again.");
        setPinValue("");
        return;
      }

      setPinError("");
      setPinValue("");
      setBootMode("post_pin");
      setPhase("identifying");
    } catch (error) {
      console.error(error);
      setPinError("PIN validation is temporarily unavailable.");
    } finally {
      setSubmittingPin(false);
    }
  };

  if (!shouldRun || phase === "hidden") {
    return null;
  }

  return (
    <div
      className={`app-access-screen app-access-screen-${phase}`}
      aria-label="Opening Defender One"
    >
      <div className="app-access-grid" aria-hidden="true" />
      <div className="app-access-scan" aria-hidden="true" />
      <div className="app-access-shell">
        <div className="app-access-topbar">
          <span>DEFENDER ONE</span>
          <span>{currentUser ? "SECURE USER SESSION" : "PUBLIC ACCESS NODE"}</span>
        </div>

        <div className="app-access-panel">
          <div className="app-access-panel-copy">
            <p className="app-access-kicker">
              {phase === "pin" ? "Launch PIN Required" : "Secure Access Sequence"}
            </p>
            <h1 className="app-access-title">Defender One</h1>
            <p className="app-access-subtitle">
              509 SFS operations platform
            </p>
          </div>

          {phase === "pin" ? (
            <div className="app-access-pin-layout">
              <div className={`app-access-console${pinError ? " app-access-console-error" : ""}`}>
                <span>APP PIN ENABLED</span>
                <span>SESSION LOCK ENGAGED</span>
                <span>{pinError || "ENTER FOUR-DIGIT ACCESS CODE"}</span>
              </div>

              <div className="app-access-pin-head">
                <div>
                  <p className="app-access-module-label">Secure Launch PIN</p>
                  <p className="app-access-pin-caption">
                    This device requires your app PIN before the session can open.
                  </p>
                </div>
                <span className="app-access-pin-badge">PIN-4</span>
              </div>

              <div className="app-access-pin-display" aria-label="App PIN entry">
                {Array.from({ length: APP_PIN_LENGTH }).map((_, index) => (
                  <span
                    key={index}
                    className={`app-access-pin-dot ${index < pinValue.length ? "app-access-pin-dot-filled" : ""}`}
                  />
                ))}
              </div>

              <div className="app-access-keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    className="app-access-key"
                    onClick={() => {
                      setPinError("");
                      setPinValue((current) =>
                        current.length < APP_PIN_LENGTH ? `${current}${digit}` : current
                      );
                    }}
                    disabled={submittingPin || pinValue.length >= APP_PIN_LENGTH}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  className="app-access-key app-access-key-muted"
                  onClick={() => setPinValue("")}
                  disabled={submittingPin || pinValue.length === 0}
                >
                  CLR
                </button>
                <button
                  type="button"
                  className="app-access-key"
                  onClick={() => {
                    setPinError("");
                    setPinValue((current) =>
                      current.length < APP_PIN_LENGTH ? `${current}0` : current
                    );
                  }}
                  disabled={submittingPin || pinValue.length >= APP_PIN_LENGTH}
                >
                  0
                </button>
                <button
                  type="button"
                  className="app-access-key app-access-key-muted"
                  onClick={() => setPinValue((current) => current.slice(0, -1))}
                  disabled={submittingPin || pinValue.length === 0}
                >
                  DEL
                </button>
              </div>

              <div className="app-access-action-row">
                <button
                  type="button"
                  className="app-access-submit"
                  onClick={() => void submitPin()}
                  disabled={submittingPin}
                >
                  {submittingPin ? "VERIFYING..." : "UNLOCK APP"}
                </button>
              </div>
            </div>
          ) : (
            <div className="app-access-runtime">
              <div className="app-access-status-stack">
                {visibleLines.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className={`app-access-status-line ${index === visibleLines.length - 1 && phase === "identifying" ? "app-access-status-line-active" : ""}`}
                  >
                    <span className="app-access-status-prompt">SYS&gt;</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              {currentUser ? (
                <div className={`app-access-identity-card ${visibleLines.length >= currentBootLines.length - 1 || phase === "granted" || phase === "closing" ? "app-access-identity-card-visible" : ""}`}>
                  <div className="app-access-identity-photo">
                    {userPhotoUrl ? (
                      <div
                        className="app-access-identity-photo-fill"
                        style={{ backgroundImage: `url(${userPhotoUrl})` }}
                      />
                    ) : (
                      <span>{userDisplayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="app-access-identity-copy">
                    <p className="app-access-module-label">USER IDENTIFICATION</p>
                    <strong>{userDisplayName}</strong>
                    <span>{userSubLabel}</span>
                  </div>
                </div>
              ) : (
                <div className={`app-access-terminal-card ${visibleLines.length >= SIGNED_OUT_LINES.length - 1 || phase === "granted" || phase === "closing" ? "app-access-terminal-card-visible" : ""}`}>
                  <p className="app-access-module-label">SESSION STATUS</p>
                  <strong>PUBLIC ACCESS TERMINAL READY</strong>
                  <span>Authentication controls remain available on the homepage.</span>
                </div>
              )}

              <div className={`app-access-granted ${phase === "granted" || phase === "closing" ? "app-access-granted-visible" : ""}`}>
                <span className="app-access-granted-label">{accessGrantedLabel}</span>
                <span className="app-access-granted-subtitle">
                  {currentUser ? "TERMINAL ACCESS APPROVED" : "HOME NODE AVAILABLE"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
