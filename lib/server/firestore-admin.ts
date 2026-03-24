import { getGoogleAccessToken } from "./google-service-account";

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null }
  | { timestampValue: string };

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ride-app-dd741";

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

  throw new Error("Unsupported Firestore admin value type.");
}

export async function patchFirestoreDocument(documentPath: string, fields: Record<string, unknown>) {
  const accessToken = await getGoogleAccessToken();
  const fieldEntries = Object.entries(fields);
  const updateMask = fieldEntries.map(([field]) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
  const encodedPath = documentPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
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

export async function deleteFirestoreDocument(documentPath: string) {
  const accessToken = await getGoogleAccessToken();
  const encodedPath = documentPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodedPath}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => "");
    throw new Error(`Could not delete Firestore document ${documentPath}: ${details || response.statusText}`);
  }
}
