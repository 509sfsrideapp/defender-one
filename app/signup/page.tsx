"use client";

import { useState } from "react";
import HomeIconLink from "../components/HomeIconLink";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { isValidUsername, normalizeUsername } from "../../lib/username";

const flightOptions = ["Alpha", "Bravo", "Charlie", "Delta", "Foxtrot", "Staff"] as const;

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rank, setRank] = useState("");
  const [flight, setFlight] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSignup = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !rank.trim() ||
      !flight.trim() ||
      !phone.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setStatusMessage("Fill out every required field before creating your account.");
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage("Password and verify password must match.");
      return;
    }

    try {
      const normalizedUsername = normalizeUsername(username);

      if (!isValidUsername(normalizedUsername)) {
        setStatusMessage("Usernames must be 3-24 characters using letters, numbers, dots, dashes, or underscores.");
        return;
      }

      const usernameSnap = await getDoc(doc(db, "usernames", normalizedUsername));

      if (usernameSnap.exists()) {
        setStatusMessage("That username is already taken.");
        return;
      }

      setStatusMessage("Creating account...");

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      const batch = writeBatch(db);
      batch.set(doc(db, "users", userCredential.user.uid), {
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        rank: rank.trim(),
        rankOrRole: rank.trim(),
        flight: flight.trim(),
        username: normalizedUsername,
        phone: phone.trim(),
        email: email.trim(),
        homeAddress: "",
        homeAddressVerified: false,
        riderPhotoUrl: "",
        driverPhotoUrl: "",
        carYear: "",
        carMake: "",
        carModel: "",
        carColor: "",
        carPlate: "",
        available: false,
        createdAt: new Date(),
      });

      batch.set(doc(db, "usernames", normalizedUsername), {
        uid: userCredential.user.uid,
        username: normalizedUsername,
        email: userCredential.user.email,
        createdAt: new Date(),
      });

      await batch.commit();

      alert("Account created");
      window.location.href = "/login";
    } catch (error) {
      console.error(error);
      setStatusMessage("Signup failed.");
    }
  };

  return (
    <main style={{ padding: 20 }}>
      <HomeIconLink />

      <h1>Create Account</h1>

      <div style={{ marginTop: 20, maxWidth: 460 }}>
        {statusMessage ? <p style={{ marginBottom: 12 }}>{statusMessage}</p> : null}

        <h2 style={{ marginTop: 0 }}>Required Now</h2>

        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First Name"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last Name"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <input
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          placeholder="Rank"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <select
          value={flight}
          onChange={(e) => setFlight(e.target.value)}
          style={{ display: "block", marginBottom: 6, width: "100%" }}
        >
          <option value="">Select Flight</option>
          {flightOptions.map((flightOption) => (
            <option key={flightOption} value={flightOption}>
              {flightOption}
            </option>
          ))}
        </select>

        <p style={{ marginTop: 0, marginBottom: 10, fontSize: 13, color: "#94a3b8" }}>
          Flight options: Alpha, Bravo, Charlie, Delta, Foxtrot, or Staff.
        </p>

        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone Number"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ display: "block", marginBottom: 10, width: "100%" }}
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Verify Password"
          style={{ display: "block", marginBottom: 16, width: "100%" }}
        />

        <h2>Finish Later</h2>
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid rgba(148, 163, 184, 0.18)",
            backgroundColor: "rgba(9, 15, 25, 0.88)",
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>Before requesting rides:</strong> add and verify your home address in Account Settings.
          </p>
          <p>
            <strong>Before driving:</strong> add your vehicle year, make, model, and color in Account Settings.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Before doing either:</strong> upload a clear profile picture so riders and drivers know who to look for.
          </p>
        </div>

        <button type="button" onClick={handleSignup} style={{ padding: 10 }}>
          Create Account
        </button>
      </div>
    </main>
  );
}
