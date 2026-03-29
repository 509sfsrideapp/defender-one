import { createSign } from "node:crypto";

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

type UserRecord = {
  id: string;
  path: string;
  carYear?: string | null;
  homeAddress?: string | null;
  homeStreet?: string | null;
};

type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
};

let accessTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeVehicleYear(value: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized || !/^\d{4}$/.test(normalized)) {
    return "";
  }

  const numericYear = Number(normalized);
  const currentYear = new Date().getFullYear() + 1;

  if (numericYear < 1900 || numericYear > currentYear) {
    return "";
  }

  return normalized;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url");
}

async function getGoogleAccessToken() {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.accessToken;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Firebase service account environment variables.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not fetch Google access token.");
  }

  const data = (await response.json()) as AccessTokenResponse;
  accessTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

function encodeDocumentPath(documentPath: string) {
  return documentPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toFirestoreValue(entry)),
      },
    };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([field, nestedValue]) => [
            field,
            toFirestoreValue(nestedValue),
          ])
        ),
      },
    };
  }

  throw new Error("Unsupported Firestore value type.");
}

function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) {
    return null;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("booleanValue" in value) {
    return value.booleanValue;
  }

  if ("integerValue" in value) {
    return Number(value.integerValue);
  }

  if ("doubleValue" in value) {
    return value.doubleValue;
  }

  if ("timestampValue" in value) {
    return value.timestampValue;
  }

  if ("nullValue" in value) {
    return null;
  }

  if ("mapValue" in value) {
    const fields = value.mapValue.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([field, fieldValue]) => [field, fromFirestoreValue(fieldValue)])
    );
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map((entry) => fromFirestoreValue(entry));
  }

  return null;
}

async function listFirestoreDocuments(collectionPath: string) {
  const accessToken = await getGoogleAccessToken();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ride-app-dd741";
  const encodedPath = encodeDocumentPath(collectionPath);

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodedPath}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Could not list Firestore documents for ${collectionPath}: ${details || response.statusText}`);
  }

  const data = (await response.json()) as {
    documents?: Array<{
      name: string;
      fields?: Record<string, FirestoreValue>;
    }>;
  };

  return (data.documents || []).map((document) => ({
    id: document.name.split("/").pop() || "",
    path: document.name.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents\//, ""),
    ...Object.fromEntries(
      Object.entries(document.fields || {}).map(([field, value]) => [field, fromFirestoreValue(value)])
    ),
  }));
}

async function patchFirestoreDocument(documentPath: string, fields: Record<string, unknown>) {
  const accessToken = await getGoogleAccessToken();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ride-app-dd741";
  const fieldEntries = Object.entries(fields);
  const updateMask = fieldEntries.map(([field]) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
  const encodedPath = encodeDocumentPath(documentPath);

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodedPath}?${updateMask}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fields: Object.fromEntries(fieldEntries.map(([field, value]) => [field, toFirestoreValue(value)])),
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Could not update Firestore document ${documentPath}: ${details || response.statusText}`);
  }
}

function shouldClearVehicleYear(user: UserRecord) {
  const rawCarYear = typeof user.carYear === "string" ? user.carYear.trim() : "";

  if (!rawCarYear) {
    return false;
  }

  if (normalizeVehicleYear(rawCarYear)) {
    return false;
  }

  const normalizedHomeAddress = typeof user.homeAddress === "string" ? user.homeAddress.trim() : "";
  const normalizedHomeStreet = typeof user.homeStreet === "string" ? user.homeStreet.trim() : "";
  const loweredCarYear = rawCarYear.toLowerCase();

  return (
    (normalizedHomeAddress && loweredCarYear === normalizedHomeAddress.toLowerCase()) ||
    (normalizedHomeStreet && loweredCarYear === normalizedHomeStreet.toLowerCase()) ||
    loweredCarYear.includes(",") ||
    /\d+\s+[a-z]/i.test(loweredCarYear)
  );
}

async function main() {
  const users = (await listFirestoreDocuments("users")) as UserRecord[];
  const corruptedUsers = users.filter(shouldClearVehicleYear);

  if (corruptedUsers.length === 0) {
    console.log("No corrupted vehicle-year records found.");
    return;
  }

  for (const user of corruptedUsers) {
    await patchFirestoreDocument(`users/${user.id}`, {
      carYear: "",
      updatedAt: new Date(),
    });
    console.log(`Cleared invalid carYear for user ${user.id}: ${String(user.carYear || "")}`);
  }

  console.log(`Repair complete. Cleared ${corruptedUsers.length} user records.`);
}

await main();
